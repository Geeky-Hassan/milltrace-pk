from collections import Counter
from sqlalchemy.orm import Session

from app.domain import ExceptionStatus, SerialStatus
from app.models import BuyerReceipt, CaneIntake, Dispatch, ExceptionAlert, PackagingSerial, ProductionBatch, WarehouseReceipt
from app.repositories.core import MillRepository
from app.schemas import ComplianceIntelligence, ComplianceRisk, DashboardMetric, DashboardSummary
from app.services.buyer_receipt import BuyerReceiptService
from app.services.warehouse import WarehouseService
from app.utils import utcnow


class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.mills = MillRepository(db)
        self.warehouse_service = WarehouseService(db)
        self.receipt_service = BuyerReceiptService(db)

    def summary(self, role: str = "mill_owner") -> DashboardSummary:
        self.warehouse_service.scan_activated_not_warehoused()
        self.receipt_service.scan_missing_receipts()
        self.db.commit()

        mill = self.mills.get_demo_mill()
        if not mill:
            raise ValueError("Demo mill is not seeded")

        today = utcnow().date()
        cane_rows = self.db.query(CaneIntake).all()
        batch_rows = self.db.query(ProductionBatch).all()
        serial_rows = self.db.query(PackagingSerial).all()
        warehouse_rows = self.db.query(WarehouseReceipt).all()
        dispatch_rows = self.db.query(Dispatch).all()
        exception_rows = self.db.query(ExceptionAlert).filter(ExceptionAlert.status == ExceptionStatus.OPEN.value).all()

        total_cane_today = sum(row.net_cane_weight_kg for row in cane_rows if row.mill_gate_timestamp.date() == today)
        total_cane_season = sum(row.net_cane_weight_kg for row in cane_rows)
        expected_output = sum(row.expected_sugar_output_kg for row in batch_rows)
        actual_output = sum(row.actual_sugar_output_kg for row in batch_rows)
        recovery_percentage = round(actual_output / total_cane_season * 100, 2) if total_cane_season else 0
        recovery_variance = actual_output - expected_output
        warehouse_stock = sum(row.total_weight_kg for row in warehouse_rows if row.status != "DISPATCHED")
        receipt_dispatch_ids = {row.dispatch_record_id for row in self.db.query(BuyerReceipt).all()}
        pending_receipts = sum(1 for row in dispatch_rows if row.id not in receipt_dispatch_ids)
        serial_counts = Counter(row.status for row in serial_rows)
        open_by_severity = Counter(row.severity for row in exception_rows)
        intelligence = self._compliance_intelligence(exception_rows, batch_rows, pending_receipts)

        metrics = [
            DashboardMetric(label="Total cane received today", value=f"{total_cane_today / 1000:.1f} tons", delta="Validated weighbridge net", tone="success"),
            DashboardMetric(label="Estimated sugar output", value=f"{expected_output / 1000:.1f} tons", delta=f"Expected recovery {mill.expected_recovery_percentage:.1f}%", tone="neutral"),
            DashboardMetric(label="Actual packaged sugar", value=f"{actual_output / 1000:.1f} tons", delta=f"{len(serial_rows):,} issued serials", tone="success"),
            DashboardMetric(label="Recovery variance", value=f"{recovery_variance / 1000:+,.2f} tons", delta=f"Recovery {recovery_percentage:.2f}%", tone="warning" if recovery_variance < 0 else "success"),
            DashboardMetric(label="Active serials", value=f"{len([row for row in serial_rows if row.status != SerialStatus.VOIDED.value]):,}", delta="Lifecycle-controlled serials", tone="neutral"),
            DashboardMetric(label="Warehouse stock", value=f"{warehouse_stock / 1000:.1f} tons", delta="By batch, SKU, location", tone="success"),
            DashboardMetric(label="Dispatches pending receipt", value=str(pending_receipts), delta="48h receipt SLA", tone="warning" if pending_receipts else "success"),
            DashboardMetric(label="Open exceptions", value=str(len(exception_rows)), delta="Compliance engine alerts", tone="danger" if exception_rows else "success"),
        ]

        return DashboardSummary(
            mill=mill,
            role=role,
            total_cane_received_today_kg=round(total_cane_today, 2),
            total_cane_received_season_kg=round(total_cane_season, 2),
            expected_sugar_output_kg=round(expected_output, 2),
            actual_sugar_output_kg=round(actual_output, 2),
            recovery_percentage=recovery_percentage,
            recovery_variance_kg=round(recovery_variance, 2),
            total_issued_serials=serial_counts.get(SerialStatus.ISSUED.value, 0),
            total_activated_serials=serial_counts.get(SerialStatus.ACTIVATED.value, 0),
            total_warehoused_serials=serial_counts.get(SerialStatus.WAREHOUSED.value, 0),
            total_dispatched_serials=serial_counts.get(SerialStatus.DISPATCHED.value, 0),
            total_received_serials=serial_counts.get(SerialStatus.RECEIVED.value, 0),
            total_voided_serials=serial_counts.get(SerialStatus.VOIDED.value, 0),
            open_exceptions_by_severity=dict(open_by_severity),
            warehouse_stock_total_kg=round(warehouse_stock, 2),
            dispatches_pending_buyer_receipt=pending_receipts,
            compliance_intelligence=intelligence,
            metrics=metrics,
            flow={
                "cane_intake": round(total_cane_today / 1000, 1),
                "production": round(actual_output / 1000, 1),
                "packaging": round(sum(row.bag_weight_kg for row in serial_rows) / 1000, 1),
                "warehouse": round(warehouse_stock / 1000, 1),
                "dispatch": round(sum(row.quantity * 50 for row in dispatch_rows) / 1000, 1),
            },
            recovery_trend=[
                {"shift": row.shift, "expected": row.expected_recovery_percentage, "actual": row.recovery_percentage}
                for row in batch_rows
            ],
            exception_breakdown=dict(open_by_severity),
        )

    def _compliance_intelligence(
        self,
        exception_rows: list[ExceptionAlert],
        batch_rows: list[ProductionBatch],
        pending_receipts: int,
    ) -> ComplianceIntelligence:
        severity_weight = {"LOW": 8, "MEDIUM": 16, "HIGH": 26, "CRITICAL": 38}
        stage_scores: Counter[str] = Counter()
        type_counts = Counter(row.type for row in exception_rows)
        risk_score = 0
        risks: list[ComplianceRisk] = []
        for alert in exception_rows:
            stage = self._stage_for_exception(alert)
            impact = severity_weight.get(alert.severity, 10)
            if alert.occurrence_count > 1:
                impact += min(alert.occurrence_count * 3, 12)
            age_hours = max((utcnow() - alert.created_at).total_seconds() / 3600, 0)
            if age_hours > 24:
                impact += 10
            stage_scores[stage] += impact
            risk_score += impact
            risks.append(
                ComplianceRisk(
                    type=alert.type,
                    severity=alert.severity,
                    stage=stage,
                    title=alert.title,
                    suggested_action=alert.suggested_action,
                    score_impact=min(impact, 100),
                )
            )

        risk_score += pending_receipts * 8
        for batch in batch_rows:
            if batch.variance_status == "CRITICAL":
                risk_score += 18
                stage_scores["Production"] += 18
            elif batch.variance_status == "WARNING":
                risk_score += 8
                stage_scores["Production"] += 8

        score = min(risk_score, 100)
        if score <= 30:
            level = "Low"
        elif score <= 60:
            level = "Medium"
        elif score <= 80:
            level = "High"
        else:
            level = "Critical"

        critical_count = sum(1 for row in exception_rows if row.severity == "CRITICAL")
        risk_trend = "worsening" if critical_count or pending_receipts > 1 else "stable"
        if score <= 30 and not pending_receipts:
            risk_trend = "improving"

        risks.sort(key=lambda item: item.score_impact, reverse=True)
        highest_stage = stage_scores.most_common(1)[0][0] if stage_scores else None
        most_common = type_counts.most_common(1)[0][0] if type_counts else None
        return ComplianceIntelligence(
            risk_score=score,
            risk_level=level,
            risk_trend=risk_trend,
            most_common_exception_type=most_common,
            highest_risk_stage=highest_stage,
            top_risks=risks[:5],
        )

    @staticmethod
    def _stage_for_exception(alert: ExceptionAlert) -> str:
        value = f"{alert.type} {alert.related_entity_type}".upper()
        if "CANE" in value or "WEIGHT" in value:
            return "Cane Intake"
        if "RECOVERY" in value or "PRODUCTION" in value:
            return "Production"
        if "SERIAL" in value:
            return "Packaging"
        if "WAREHOUSE" in value or "ACTIVATED_NOT_WAREHOUSED" in value:
            return "Warehouse"
        if "DISPATCH" in value:
            return "Dispatch"
        if "RECEIPT" in value or "BUYER" in value:
            return "Buyer Receipt"
        return "Compliance"
