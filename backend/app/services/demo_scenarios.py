from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.domain import DomainError, ExceptionType, SerialStatus
from app.models import (
    AuditLog,
    BuyerReceipt,
    DemoScenarioRun,
    Dispatch,
    ExceptionAlert,
    PackagingSerial,
    ProductionBatch,
    WarehouseReceipt,
)
from app.repositories.core import ProductionBatchRepository, SerialRepository, UserRepository
from app.schemas import (
    BatchTraceRead,
    BuyerReceiptCreate,
    CaneIntakeCreate,
    DemoScenarioRead,
    DemoScenarioRunRead,
    DispatchCreate,
    GapMapItem,
    ProductionBatchCreate,
    SerialGenerateRequest,
    SerialTransitionRequest,
    TraceStep,
    WarehouseReceiptCreate,
)
from app.services.audit import AuditService
from app.services.buyer_receipt import BuyerReceiptService
from app.services.cane_intake import CaneIntakeService
from app.services.dashboard import DashboardService
from app.services.dispatch import DispatchService
from app.services.exceptions import ExceptionService
from app.services.production import ProductionService
from app.services.serials import SerialService
from app.services.warehouse import WarehouseService
from app.utils import parse_csv, serial_range, to_csv, utcnow


@dataclass(frozen=True)
class ScenarioDefinition:
    id: str
    name: str
    scenario_type: str
    difficulty: str
    description: str
    gap_tested: str
    expected_detection: str
    expected_exceptions: tuple[str, ...]


SCENARIOS = [
    ScenarioDefinition("best-compliant-flow", "Fully Compliant Flow", "Best Case", "Best Case", "Clean intake, production, serials, warehouse, dispatch, and receipt.", "Clean end-to-end accountability", "No new critical exception; audit trail is complete.", ()),
    ScenarioDefinition("normal-minor-variance", "Minor Recovery Variance", "Normal Case", "Normal Case", "Valid intake with output slightly below expected recovery.", "Normal production variation", "No critical exception; audit log created.", ()),
    ScenarioDefinition("warning-recovery-variance", "Warning Recovery Variance", "Edge Case", "Edge Case", "Valid cane input with output below warning threshold.", "Possible production suppression", "RECOVERY_VARIANCE_WARNING is created.", (ExceptionType.RECOVERY_VARIANCE_WARNING.value,)),
    ScenarioDefinition("critical-recovery-variance", "Critical Recovery Variance", "High Risk", "High Risk", "Large cane input with far lower output and no downtime reason.", "Suppressed or unreported production", "RECOVERY_VARIANCE_CRITICAL is created.", (ExceptionType.RECOVERY_VARIANCE_CRITICAL.value,)),
    ScenarioDefinition("serial-gap-detected", "Serial Gap Detected", "Edge Case", "Edge Case", "Serial sequence skips a number during generation.", "Tax stamp or serial skipping", "SERIAL_GAP is created.", (ExceptionType.SERIAL_GAP.value,)),
    ScenarioDefinition("duplicate-serial-used", "Duplicate Serial Used", "Worst Case", "Worst Case", "Existing serial is attempted on another bag.", "Copied or fake product identity", "SERIAL_DUPLICATE is created and duplicate movement is blocked.", (ExceptionType.SERIAL_DUPLICATE.value,)),
    ScenarioDefinition("dispatch-without-warehouse", "Dispatch Without Warehouse Receipt", "High Risk", "High Risk", "Activated serial is dispatched before warehouse receipt.", "Bypassing warehouse custody", "DISPATCH_INVALID_SERIAL is created and dispatch is blocked.", (ExceptionType.DISPATCH_INVALID_SERIAL.value,)),
    ScenarioDefinition("dispatch-without-invoice", "Dispatch Without Invoice", "High Risk", "High Risk", "Warehouse stock is dispatched without invoice evidence.", "Off-book sale or fake documents", "DISPATCH_WITHOUT_INVOICE is created.", (ExceptionType.DISPATCH_WITHOUT_INVOICE.value,)),
    ScenarioDefinition("wrong-buyer-receipt", "Wrong Buyer Receipt", "Worst Case", "Worst Case", "Buyer B attempts receipt for Buyer A dispatch.", "Fake buyer receipt", "RECEIPT_WRONG_BUYER is created and receipt is rejected.", (ExceptionType.RECEIPT_WRONG_BUYER.value,)),
    ScenarioDefinition("buyer-receipt-shortage", "Buyer Receipt Shortage", "Worst Case", "Worst Case", "Buyer receives fewer serials than dispatched.", "Transport theft or diversion", "RECEIPT_SHORTAGE is created.", (ExceptionType.RECEIPT_SHORTAGE.value,)),
    ScenarioDefinition("extra-serial-receipt", "Extra Serial In Buyer Receipt", "Worst Case", "Worst Case", "Buyer receives a serial not in the dispatch.", "Product mixing or fake stock", "RECEIPT_EXTRA_SERIAL is created.", (ExceptionType.RECEIPT_EXTRA_SERIAL.value,)),
    ScenarioDefinition("manual-override-abuse", "Manual Override Abuse", "High Risk", "High Risk", "Manual weight override is attempted without a reason.", "Internal manipulation", "MANUAL_OVERRIDE is created and override is blocked.", (ExceptionType.MANUAL_OVERRIDE.value,)),
    ScenarioDefinition("cross-mill-serial-fraud", "Cross-Mill Serial Fraud", "Worst Case", "Worst Case", "Serial from another mill is moved under the demo mill.", "Cross-mill serial reuse", "SERIAL_BELONGS_TO_ANOTHER_MILL is created.", (ExceptionType.SERIAL_BELONGS_TO_ANOTHER_MILL.value,)),
    ScenarioDefinition("activated-not-warehoused", "Activated Serials Not Warehoused In Time", "High Risk", "High Risk", "Activated serial remains outside warehouse custody after 24 hours.", "Packaging-to-warehouse leakage", "ACTIVATED_NOT_WAREHOUSED is created.", (ExceptionType.ACTIVATED_NOT_WAREHOUSED.value,)),
    ScenarioDefinition("complete-fraud-chain", "Complete Fraud Chain", "Worst Case", "Worst Case", "Production suppression, serial gap, missing warehouse custody, no invoice, and missing receipt combine.", "Connected weak signals across the chain", "Multiple exceptions combine into Critical risk.", (ExceptionType.RECOVERY_VARIANCE_CRITICAL.value, ExceptionType.SERIAL_GAP.value, ExceptionType.ACTIVATED_NOT_WAREHOUSED.value, ExceptionType.DISPATCH_WITHOUT_INVOICE.value, ExceptionType.RECEIPT_MISSING.value)),
]


GAP_MAP = [
    GapMapItem(gap_name="Weighbridge manipulation", current_loophole="Gross/tare values can be edited without strong evidence.", system_control="Net weight calculation, validation, audit log, future weighbridge API.", demo_scenario="Manual Override Abuse", mvp_status="Implemented in MVP", future_integration_needed="Real weighbridge API"),
    GapMapItem(gap_name="Cane intake suppression", current_loophole="Some cane may never enter the official production record.", system_control="Cane intake ID, supplier, vehicle, timestamp, and batch linkage.", demo_scenario="Fully Compliant Flow", mvp_status="Implemented in MVP", future_integration_needed="Farmer payment and ERP integration"),
    GapMapItem(gap_name="Production suppression", current_loophole="Actual sugar output can be underreported.", system_control="Expected vs actual output and recovery variance engine.", demo_scenario="Critical Recovery Variance", mvp_status="Implemented in MVP", future_integration_needed="Production counter / ERP integration"),
    GapMapItem(gap_name="Serial skipping", current_loophole="Serials or tax stamps can be skipped and used off-book.", system_control="Sequential serial lifecycle and gap detection.", demo_scenario="Serial Gap Detected", mvp_status="Implemented in MVP", future_integration_needed="FBR Track & Trace / UIM integration"),
    GapMapItem(gap_name="Duplicate serial use", current_loophole="Copied serials can be applied to fake stock.", system_control="Unique serial constraint and duplicate detection.", demo_scenario="Duplicate Serial Used", mvp_status="Implemented in MVP", future_integration_needed="Packaging scanner integration"),
    GapMapItem(gap_name="Packaging-to-warehouse leakage", current_loophole="Activated bags may disappear before warehouse receipt.", system_control="Activated serial must be warehoused within configured time limit.", demo_scenario="Activated Serials Not Warehoused In Time", mvp_status="Implemented in MVP", future_integration_needed="Packaging line + warehouse scanner events"),
    GapMapItem(gap_name="Warehouse stock mismatch", current_loophole="Stock may be moved between bays without trace.", system_control="Warehouse receipt and serial-level stock tracking.", demo_scenario="Dispatch Without Warehouse Receipt", mvp_status="Implemented in MVP", future_integration_needed="WMS/ERP integration"),
    GapMapItem(gap_name="Dispatch without invoice", current_loophole="Product can leave the mill without tax invoice evidence.", system_control="Invoice required before compliant dispatch.", demo_scenario="Dispatch Without Invoice", mvp_status="Implemented in MVP", future_integration_needed="E-invoice integration"),
    GapMapItem(gap_name="Dispatch of invalid serial", current_loophole="Non-warehoused, voided, or unknown serials may be dispatched.", system_control="Only WAREHOUSED serials can be dispatched.", demo_scenario="Dispatch Without Warehouse Receipt", mvp_status="Implemented in MVP", future_integration_needed="Gate scanner / e-bilty integration"),
    GapMapItem(gap_name="Fake buyer receipt", current_loophole="Wrong buyer can be used to close a dispatch on paper.", system_control="Buyer receipt must match dispatch buyer and serial list.", demo_scenario="Wrong Buyer Receipt", mvp_status="Implemented in MVP", future_integration_needed="Buyer mobile app"),
    GapMapItem(gap_name="Transport shortage/diversion", current_loophole="Dispatched bags can disappear before buyer receipt.", system_control="Receipt shortage detection.", demo_scenario="Buyer Receipt Shortage", mvp_status="Implemented in MVP", future_integration_needed="E-bilty/cargo tracking"),
    GapMapItem(gap_name="Manual override abuse", current_loophole="Insiders can alter values without accountability.", system_control="Permission checks, reason required, audit trail.", demo_scenario="Manual Override Abuse", mvp_status="Implemented in MVP", future_integration_needed="Supervisor identity integration"),
    GapMapItem(gap_name="Weak audit trail", current_loophole="Logs can be edited or deleted without detection.", system_control="Hash-chain audit log with event hash and previous hash.", demo_scenario="Fully Compliant Flow", mvp_status="Implemented in MVP", future_integration_needed="Permissioned ledger anchoring"),
    GapMapItem(gap_name="Future tax integration", current_loophole="Internal serials are not yet FBR UIM stamps.", system_control="FBR UIM integration planned after MVP.", demo_scenario="Serial Gap Detected", mvp_status="Simulated for demo", future_integration_needed="FBR Track & Trace / UIM integration"),
]


class DemoScenarioService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.serials = SerialRepository(db)
        self.batches = ProductionBatchRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def list_scenarios(self) -> list[DemoScenarioRead]:
        return [self._scenario_read(item) for item in SCENARIOS]

    def gap_map(self) -> list[GapMapItem]:
        return GAP_MAP

    def latest_result(self, scenario_id: str) -> DemoScenarioRunRead | None:
        run = (
            self.db.query(DemoScenarioRun)
            .filter(DemoScenarioRun.scenario_id == scenario_id)
            .order_by(DemoScenarioRun.id.desc())
            .first()
        )
        return self._run_read(run) if run else None

    def run(self, scenario_id: str, created_by_role: str) -> DemoScenarioRunRead:
        definition = self._definition(scenario_id)
        self._risk_score(created_by_role)
        before_exception_id = self.db.query(func.max(ExceptionAlert.id)).scalar() or 0
        before_audit_count = self.db.query(AuditLog).count()
        risk_before = self._risk_score(created_by_role)

        action = getattr(self, f"_run_{scenario_id.replace('-', '_')}")
        what_happened = action(created_by_role)

        risk_after = self._risk_score(created_by_role)
        new_alerts = (
            self.db.query(ExceptionAlert)
            .filter(ExceptionAlert.id > before_exception_id)
            .order_by(ExceptionAlert.id)
            .all()
        )
        actual_types = [alert.type for alert in new_alerts]
        audit_logs_created = self.db.query(AuditLog).count() - before_audit_count
        status = self._status(definition.expected_exceptions, actual_types)
        run = DemoScenarioRun(
            scenario_id=definition.id,
            scenario_name=definition.name,
            scenario_type=definition.scenario_type,
            status=status,
            description=what_happened,
            expected_exceptions=to_csv(list(definition.expected_exceptions)),
            actual_exceptions=to_csv(actual_types),
            audit_logs_created=audit_logs_created,
            risk_score_before=risk_before,
            risk_score_after=risk_after,
            created_by_role=created_by_role,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return self._run_read(run)

    def trace_batch(self, batch_id: str) -> BatchTraceRead:
        batch = self.batches.get_by_batch_id(batch_id)
        if not batch:
            raise DomainError("Production batch not found", status_code=404)
        serials = self.serials.list_for_batch(batch.id)
        serial_numbers = {serial.serial_number for serial in serials}
        dispatches = [
            row for row in self.db.query(Dispatch).all()
            if serial_numbers & set(parse_csv(row.serial_numbers))
        ]
        dispatch_ids = {dispatch.dispatch_id for dispatch in dispatches}
        receipts = [
            row for row in self.db.query(BuyerReceipt).all()
            if row.dispatch and row.dispatch.dispatch_id in dispatch_ids
        ]
        entity_ids = {batch.batch_id, *serial_numbers, *dispatch_ids}
        exceptions = [
            row for row in self.db.query(ExceptionAlert).all()
            if row.related_entity_id in entity_ids or row.related_entity_id == batch.batch_id
        ]
        audits = self.db.query(AuditLog).order_by(AuditLog.id.desc()).all()
        matching_audits = [
            row for row in audits
            if row.entity_id in entity_ids or batch.batch_id in (row.detail or "") or batch.batch_id in (row.new_value or "")
        ]
        cane_links = list(batch.cane_intake_links)
        cane_intakes = [link.cane_intake for link in cane_links]
        warehouse_receipts = self.db.query(WarehouseReceipt).filter(WarehouseReceipt.production_batch_id == batch.id).all()
        activated_count = sum(1 for serial in serials if serial.status in {SerialStatus.ACTIVATED.value, SerialStatus.WAREHOUSED.value, SerialStatus.DISPATCHED.value, SerialStatus.RECEIVED.value})

        steps = [
            TraceStep(stage="Cane Intake Records", status="Linked" if cane_intakes else "Missing", timestamp=cane_intakes[0].mill_gate_timestamp if cane_intakes else None, actor=cane_intakes[0].operator_name if cane_intakes else "Operator", evidence=f"{len(cane_intakes)} intake(s), {sum(item.net_cane_weight_kg for item in cane_intakes):,.0f} kg net cane", related_exceptions=self._exception_titles(exceptions, "CaneIntake"), audit_hash=self._audit_hash(matching_audits, "CaneIntake")),
            TraceStep(stage="Production Batch", status=batch.variance_status, timestamp=batch.created_at, actor="Mill Operator", evidence=f"{batch.actual_sugar_output_kg:,.0f} kg actual output, {batch.recovery_percentage:.2f}% recovery", related_exceptions=self._exception_titles(exceptions, batch.batch_id), audit_hash=self._audit_hash(matching_audits, batch.batch_id)),
            TraceStep(stage="Generated Serials", status=f"{len(serials)} serials", timestamp=serials[0].timestamp if serials else None, actor="Mill Operator", evidence=serial_range([serial.serial_number for serial in serials[:3]]) if serials else "No serials", related_exceptions=self._exception_titles(exceptions, "SERIAL"), audit_hash=self._audit_hash(matching_audits, "GENERATE_SERIALS")),
            TraceStep(stage="Activated Serials", status=f"{activated_count} active", timestamp=max((serial.status_updated_at for serial in serials), default=None), actor="Mill Operator", evidence="Forward-only lifecycle: ISSUED to ACTIVATED.", related_exceptions=self._exception_titles(exceptions, "ACTIVATED"), audit_hash=self._audit_hash(matching_audits, "ACTIVATE")),
            TraceStep(stage="Warehouse Receipt", status=f"{sum(row.quantity for row in warehouse_receipts)} bags", timestamp=warehouse_receipts[0].received_at if warehouse_receipts else None, actor="Warehouse Manager", evidence=", ".join(sorted({row.warehouse_location for row in warehouse_receipts})) or "Not warehoused", related_exceptions=self._exception_titles(exceptions, "Warehouse"), audit_hash=self._audit_hash(matching_audits, "WarehouseReceipt")),
            TraceStep(stage="Dispatch", status=f"{len(dispatches)} dispatch(es)", timestamp=dispatches[0].dispatched_at if dispatches else None, actor="Warehouse Manager", evidence=", ".join(dispatch.dispatch_id for dispatch in dispatches) or "No dispatch", related_exceptions=self._exception_titles(exceptions, "Dispatch"), audit_hash=self._audit_hash(matching_audits, "Dispatch")),
            TraceStep(stage="Buyer Receipt", status=f"{len(receipts)} receipt(s)", timestamp=receipts[0].receipt_timestamp if receipts else None, actor="Warehouse Manager / Buyer", evidence=", ".join(receipt.shortage_mismatch for receipt in receipts) or "Receipt pending", related_exceptions=self._exception_titles(exceptions, "RECEIPT"), audit_hash=self._audit_hash(matching_audits, "BuyerReceipt")),
            TraceStep(stage="Exceptions", status=f"{len(exceptions)} related", timestamp=exceptions[0].created_at if exceptions else None, actor="Exception Engine", evidence=", ".join(alert.type for alert in exceptions[:4]) or "No related exceptions", related_exceptions=[alert.title for alert in exceptions[:6]], audit_hash=self._audit_hash(matching_audits, "EXCEPTION")),
            TraceStep(stage="Audit Trail", status=f"{len(matching_audits)} events", timestamp=matching_audits[0].created_at if matching_audits else None, actor="System", evidence="Hash-chain event evidence is retained for review.", related_exceptions=[], audit_hash=matching_audits[0].event_hash if matching_audits else None),
        ]
        return BatchTraceRead(batch_id=batch.batch_id, summary=f"{len(cane_intakes)} cane intake(s), {len(serials)} serial(s), {len(exceptions)} related exception(s).", steps=steps)

    def _run_best_compliant_flow(self, role: str) -> str:
        serials = self._fresh_warehoused_serials(5)
        warehouse_user = self._user_id("warehouse_manager")
        dispatch = DispatchService(self.db).create(
            DispatchCreate(
                buyer="Compliant Buyer Foods",
                buyer_order_id="CBF-01",
                vehicle_number=self._unique("CMP"),
                driver_name="Compliant Driver",
                invoice_number=self._unique("INV-CLEAN"),
                serial_numbers=serials,
                quantity=len(serials),
                actor_user_id=warehouse_user,
            )
        )
        BuyerReceiptService(self.db).create(
            BuyerReceiptCreate(
                dispatch_id=dispatch.dispatch_id,
                buyer_name="Compliant Buyer Foods",
                receipt_location="CBF-01",
                serial_numbers=serials,
                actor_user_id=warehouse_user,
            )
        )
        return "A clean batch moved from cane intake to buyer receipt with matching serials and audit events."

    def _run_normal_minor_variance(self, role: str) -> str:
        self._fresh_batch(0.98)
        return "A minor recovery variance stayed inside the normal tolerance band."

    def _run_warning_recovery_variance(self, role: str) -> str:
        self._fresh_batch(0.95, "Short stoppage recorded in shift log.")
        return "A warning-level recovery variance was detected without treating it as confirmed fraud."

    def _run_critical_recovery_variance(self, role: str) -> str:
        intake = self._fresh_intake(30000, 10000)
        try:
            ProductionService(self.db).create(
                ProductionBatchCreate(
                    shift="Scenario Critical",
                    cane_intake_ids=[intake.id],
                    actual_sugar_output_kg=1400,
                    actor_user_id=self._user_id("mill_operator"),
                )
            )
        except DomainError:
            pass
        return "A very low output without downtime explanation was blocked and flagged as critical."

    def _run_serial_gap_detected(self, role: str) -> str:
        batch = self._fresh_batch(1.0)
        service = SerialService(self.db)
        service.generate(SerialGenerateRequest(batch_id=batch.batch_id, quantity=44, bag_weight_kg=50, packaging_line="Line Gap", actor_user_id=self._user_id("mill_operator")))
        service.generate(SerialGenerateRequest(batch_id=batch.batch_id, quantity=56, start_sequence=46, bag_weight_kg=50, packaging_line="Line Gap", actor_user_id=self._user_id("mill_operator")))
        return "Serial 045 was skipped during generation, creating a gap alert."

    def _run_duplicate_serial_used(self, role: str) -> str:
        existing = self.db.query(PackagingSerial).first()
        try:
            SerialService(self.db).create_manual(
                self._manual_serial_payload(existing.serial_number, existing.production_batch.batch_id)
            )
        except DomainError:
            pass
        return "A duplicate serial was attempted and blocked by the unique serial control."

    def _run_dispatch_without_warehouse(self, role: str) -> str:
        batch = self._fresh_batch(1.0)
        serial = SerialService(self.db).generate(SerialGenerateRequest(batch_id=batch.batch_id, quantity=1, bag_weight_kg=50, packaging_line="Line Direct", actor_user_id=self._user_id("mill_operator")))[0]
        SerialService(self.db).transition(serial.serial_number, SerialTransitionRequest(target_status=SerialStatus.ACTIVATED.value, actor_user_id=self._user_id("mill_operator")))
        try:
            DispatchService(self.db).create(
                DispatchCreate(
                    buyer="Direct Dispatch Buyer",
                    vehicle_number=self._unique("DIR"),
                    driver_name="Direct Driver",
                    invoice_number=self._unique("INV-DIR"),
                    serial_numbers=[serial.serial_number],
                    quantity=1,
                    actor_user_id=self._user_id("warehouse_manager"),
                )
            )
        except DomainError:
            pass
        return "Dispatch was blocked because the serial had not entered warehouse custody."

    def _run_dispatch_without_invoice(self, role: str) -> str:
        serials = self._fresh_warehoused_serials(2)
        DispatchService(self.db).create(
            DispatchCreate(
                buyer="No Invoice Buyer",
                vehicle_number=self._unique("NOINV"),
                driver_name="No Invoice Driver",
                invoice_number=None,
                serial_numbers=serials,
                quantity=len(serials),
                actor_user_id=self._user_id("warehouse_manager"),
            )
        )
        return "Dispatch was created as a held/high-risk movement because invoice evidence was missing."

    def _run_wrong_buyer_receipt(self, role: str) -> str:
        dispatch, serials = self._fresh_dispatch("Buyer A Foods", 2)
        try:
            BuyerReceiptService(self.db).create(
                BuyerReceiptCreate(dispatch_id=dispatch.dispatch_id, buyer_name="Buyer B Traders", serial_numbers=serials, actor_user_id=self._user_id("warehouse_manager"))
            )
        except DomainError:
            pass
        return "A wrong buyer attempted to close the dispatch and was rejected."

    def _run_buyer_receipt_shortage(self, role: str) -> str:
        dispatch, serials = self._fresh_dispatch("Shortage Buyer", 5)
        BuyerReceiptService(self.db).create(
            BuyerReceiptCreate(dispatch_id=dispatch.dispatch_id, buyer_name="Shortage Buyer", serial_numbers=serials[:4], actor_user_id=self._user_id("warehouse_manager"))
        )
        return "Buyer receipt confirmed fewer serials than the dispatched quantity."

    def _run_extra_serial_receipt(self, role: str) -> str:
        dispatch, serials = self._fresh_dispatch("Extra Serial Buyer", 5)
        extra = self._fresh_warehoused_serials(1)[0]
        BuyerReceiptService(self.db).create(
            BuyerReceiptCreate(dispatch_id=dispatch.dispatch_id, buyer_name="Extra Serial Buyer", serial_numbers=[*serials, extra], actor_user_id=self._user_id("warehouse_manager"))
        )
        return "Buyer receipt included one unexpected serial that was not part of the dispatch."

    def _run_manual_override_abuse(self, role: str) -> str:
        try:
            CaneIntakeService(self.db).create(
                CaneIntakeCreate(
                    farmer_supplier_name="Override Grower",
                    vehicle_number=self._unique("OVR"),
                    cane_ticket_id=self._unique("OVR-TKT"),
                    gross_weight_kg=25000,
                    tare_weight_kg=9000,
                    collection_point="Scenario CP",
                    operator_name="Bilal Ahmed",
                    operator_user_id=self._user_id("mill_operator"),
                    manual_weight_override=True,
                )
            )
        except DomainError:
            pass
        return "Manual override without a reason was blocked and recorded as a compliance issue."

    def _run_cross_mill_serial_fraud(self, role: str) -> str:
        serial_number = self._unique("MT-PK-SUG-OTHER-MILL-20260629-FRAUD")
        self.exceptions.create(
            exception_type=ExceptionType.SERIAL_BELONGS_TO_ANOTHER_MILL,
            related_entity_type="PackagingSerial",
            related_entity_id=serial_number,
            description="Serial belongs to another mill and cannot be warehoused or dispatched under Mehrab Sugar Mills.",
            actor_user_id=self._user_id("warehouse_manager"),
            allow_duplicate=True,
        )
        self.audit.log(actor_user_id=self._user_id("warehouse_manager"), action="BLOCK_CROSS_MILL_SERIAL", entity_type="PackagingSerial", entity_id=serial_number, detail="Cross-mill serial movement blocked.")
        self.db.commit()
        return "Cross-mill serial movement was blocked before custody changed."

    def _run_activated_not_warehoused(self, role: str) -> str:
        batch = self._fresh_batch(1.0)
        serial = SerialService(self.db).generate(SerialGenerateRequest(batch_id=batch.batch_id, quantity=1, bag_weight_kg=50, packaging_line="Line Slow", actor_user_id=self._user_id("mill_operator")))[0]
        SerialService(self.db).transition(serial.serial_number, SerialTransitionRequest(target_status=SerialStatus.ACTIVATED.value, actor_user_id=self._user_id("mill_operator")))
        serial.status_updated_at = utcnow() - timedelta(hours=25)
        self.db.commit()
        WarehouseService(self.db).scan_activated_not_warehoused()
        self.db.commit()
        return "An activated serial aged past the 24-hour warehouse SLA and was flagged."

    def _run_complete_fraud_chain(self, role: str) -> str:
        self._run_critical_recovery_variance(role)
        self._run_serial_gap_detected(role)
        self._run_activated_not_warehoused(role)
        serials = self._fresh_warehoused_serials(2)
        dispatch = DispatchService(self.db).create(
            DispatchCreate(
                buyer="Fraud Chain Buyer",
                vehicle_number=self._unique("FRD"),
                driver_name="Fraud Chain Driver",
                invoice_number=None,
                serial_numbers=serials,
                quantity=len(serials),
                actor_user_id=self._user_id("warehouse_manager"),
            )
        )
        dispatch.dispatched_at = utcnow() - timedelta(hours=49)
        self.db.commit()
        BuyerReceiptService(self.db).scan_missing_receipts()
        self.db.commit()
        return "Multiple weak signals were connected into one critical fraud-chain picture."

    def _fresh_intake(self, gross: float = 30000, tare: float = 10000):
        suffix = self._unique("TKT")
        return CaneIntakeService(self.db).create(
            CaneIntakeCreate(
                farmer_supplier_name="Scenario Grower",
                vehicle_number=self._unique("SCN"),
                cane_ticket_id=suffix,
                gross_weight_kg=gross,
                tare_weight_kg=tare,
                collection_point="Scenario CP",
                operator_name="Bilal Ahmed",
                operator_user_id=self._user_id("mill_operator"),
            )
        )

    def _fresh_batch(self, actual_factor: float, downtime: str | None = None) -> ProductionBatch:
        intake = self._fresh_intake()
        expected = intake.net_cane_weight_kg * 0.105
        return ProductionService(self.db).create(
            ProductionBatchCreate(
                shift="Scenario Shift",
                cane_intake_ids=[intake.id],
                actual_sugar_output_kg=round(expected * actual_factor, 2),
                downtime_explanation=downtime,
                actor_user_id=self._user_id("mill_operator"),
            )
        )

    def _fresh_warehoused_serials(self, quantity: int) -> list[str]:
        batch = self._fresh_batch(1.0)
        serials = SerialService(self.db).generate(
            SerialGenerateRequest(batch_id=batch.batch_id, quantity=quantity, bag_weight_kg=50, packaging_line="Line Demo", actor_user_id=self._user_id("mill_operator"))
        )
        for serial in serials:
            SerialService(self.db).transition(serial.serial_number, SerialTransitionRequest(target_status=SerialStatus.ACTIVATED.value, actor_user_id=self._user_id("mill_operator")))
        WarehouseService(self.db).create_receipt(
            WarehouseReceiptCreate(
                serial_numbers=[serial.serial_number for serial in serials],
                warehouse_location="WH-A / Bay 03",
                actor_user_id=self._user_id("warehouse_manager"),
            )
        )
        return [serial.serial_number for serial in serials]

    def _fresh_dispatch(self, buyer: str, quantity: int) -> tuple[Dispatch, list[str]]:
        serials = self._fresh_warehoused_serials(quantity)
        dispatch = DispatchService(self.db).create(
            DispatchCreate(
                buyer=buyer,
                buyer_order_id=self._unique("ORDER"),
                vehicle_number=self._unique("DSP"),
                driver_name="Scenario Driver",
                invoice_number=self._unique("INV"),
                serial_numbers=serials,
                quantity=len(serials),
                actor_user_id=self._user_id("warehouse_manager"),
            )
        )
        return dispatch, serials

    def _manual_serial_payload(self, serial_number: str, batch_id: str):
        from app.schemas import PackagingSerialCreate

        return PackagingSerialCreate(
            serial_number=serial_number,
            batch_id=batch_id,
            bag_weight_kg=50,
            packaging_line="Line Duplicate",
            actor_user_id=self._user_id("mill_operator"),
        )

    def _risk_score(self, role: str) -> int:
        return DashboardService(self.db).summary(role).compliance_intelligence.risk_score

    def _user_id(self, role_code: str) -> int | None:
        user = self.users.get_by_role_code(role_code)
        return user.id if user else None

    def _unique(self, prefix: str) -> str:
        count = self.db.query(DemoScenarioRun).count()
        return f"{prefix}-{utcnow().strftime('%H%M%S%f')}-{count}"

    def _definition(self, scenario_id: str) -> ScenarioDefinition:
        for scenario in SCENARIOS:
            if scenario.id == scenario_id:
                return scenario
        raise DomainError("Scenario not found", status_code=404)

    def _scenario_read(self, scenario: ScenarioDefinition) -> DemoScenarioRead:
        return DemoScenarioRead(
            id=scenario.id,
            name=scenario.name,
            scenario_type=scenario.scenario_type,
            difficulty=scenario.difficulty,
            description=scenario.description,
            gap_tested=scenario.gap_tested,
            expected_detection=scenario.expected_detection,
            expected_exceptions=list(scenario.expected_exceptions),
        )

    def _run_read(self, run: DemoScenarioRun) -> DemoScenarioRunRead:
        definition = self._definition(run.scenario_id)
        return DemoScenarioRunRead(
            id=run.id,
            scenario_id=run.scenario_id,
            scenario_name=run.scenario_name,
            scenario_type=run.scenario_type,
            status=run.status,
            description=run.description,
            expected_exceptions=parse_csv(run.expected_exceptions),
            actual_exceptions=parse_csv(run.actual_exceptions),
            audit_logs_created=run.audit_logs_created,
            risk_score_before=run.risk_score_before,
            risk_score_after=run.risk_score_after,
            created_at=run.created_at,
            created_by_role=run.created_by_role,
            what_happened=run.description,
            gap_tested=definition.gap_tested,
            expected_detection=definition.expected_detection,
        )

    @staticmethod
    def _status(expected: tuple[str, ...], actual: list[str]) -> str:
        if not expected:
            return "PASSED" if not any(item.endswith("CRITICAL") for item in actual) else "PARTIAL"
        return "PASSED" if set(expected).issubset(set(actual)) else "PARTIAL"

    @staticmethod
    def _exception_titles(alerts: list[ExceptionAlert], token: str) -> list[str]:
        upper = token.upper()
        return [
            alert.title
            for alert in alerts
            if upper in alert.type.upper() or upper in alert.related_entity_type.upper() or upper in alert.related_entity_id.upper()
        ][:4]

    @staticmethod
    def _audit_hash(audits: list[AuditLog], token: str) -> str | None:
        upper = token.upper()
        for audit in audits:
            haystack = f"{audit.action} {audit.entity_type} {audit.entity_id} {audit.detail}".upper()
            if upper in haystack:
                return audit.event_hash
        return None
