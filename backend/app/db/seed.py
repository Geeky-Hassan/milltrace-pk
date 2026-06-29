from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import ExceptionStatus, ExceptionType, SerialStatus
from app.models import (
    AuditLog,
    BuyerReceipt,
    CaneIntake,
    DemoScenarioRun,
    Dispatch,
    ExceptionAlert,
    FarmerSupplier,
    Mill,
    PackagingSerial,
    ProductionBatch,
    ProductionBatchCaneIntake,
    Role,
    User,
    WarehouseReceipt,
)
from app.services.audit import AuditService
from app.utils import serial_range, to_csv, utcnow


ROLE_DEFINITIONS = [
    ("mill_owner", "Mill Owner", "Views business, production, stock, risk, and compliance status."),
    ("mill_operator", "Mill Operator", "Creates cane intake, production batches, and serial activation evidence."),
    ("warehouse_manager", "Warehouse Manager", "Receives activated serials into warehouse and creates dispatches."),
    ("fbr_officer", "FBR Officer", "Reviews compliance dashboard, exceptions, serial lifecycle, and audit logs."),
    ("government_admin", "Government Admin", "Views high-level compliance and policy-level monitoring."),
    ("auditor", "Auditor", "Reviews evidence, audit logs, and exception resolution."),
]

USER_DEFINITIONS = [
    ("mill_owner", "Ayesha Khan", "owner@mehrab.example", "Active"),
    ("mill_operator", "Bilal Ahmed", "operator@mehrab.example", "Active"),
    ("warehouse_manager", "Sara Malik", "warehouse@mehrab.example", "Active"),
    ("fbr_officer", "Faisal Raza", "fbr@mehrab.example", "Active"),
    ("government_admin", "Nadia Qureshi", "admin@gov.example", "Active"),
    ("auditor", "Omar Siddiqui", "auditor@mehrab.example", "Active"),
]

SUPPLIER_DEFINITIONS = [
    ("Haji Iqbal Farms", "31303-1122334-5", "0300-1122334", "Kot Samaba"),
    ("Al-Rehman Growers", "31303-5566778-9", "0301-5566778", "Sadiqabad"),
    ("Chaudhry Cane Supply", "31303-9988776-1", "0302-9988776", "Liaquatpur"),
]

OPERATIONAL_MODELS = [
    DemoScenarioRun,
    AuditLog,
    ExceptionAlert,
    PackagingSerial,
    BuyerReceipt,
    Dispatch,
    WarehouseReceipt,
    ProductionBatchCaneIntake,
    ProductionBatch,
    CaneIntake,
]


def seed_database(db: Session) -> None:
    if settings.seed_demo_data:
        load_demo_seed_data(db)


def ensure_demo_reference_data(db: Session) -> tuple[Mill, dict[str, User], list[FarmerSupplier]]:
    roles: dict[str, Role] = {}
    for code, name, description in ROLE_DEFINITIONS:
        role = db.query(Role).filter(Role.code == code).first()
        if not role:
            role = Role(code=code, name=name, description=description)
            db.add(role)
        else:
            role.name = name
            role.description = description
        roles[code] = role
    db.flush()

    mill = db.query(Mill).filter(Mill.code == "MEHRAB").first()
    if not mill:
        mill = Mill(
            code="MEHRAB",
            name="Mehrab Sugar Mills",
            province="Punjab",
            district="Rahim Yar Khan",
            license_number="PSMA-RYK-042",
            ntn="7394821-6",
            expected_recovery_percentage=settings.default_expected_recovery_percentage,
            activated_warehouse_limit_hours=settings.activated_warehouse_limit_hours,
            dispatch_receipt_limit_hours=settings.dispatch_receipt_limit_hours,
        )
        db.add(mill)
    else:
        mill.expected_recovery_percentage = settings.default_expected_recovery_percentage
        mill.activated_warehouse_limit_hours = settings.activated_warehouse_limit_hours
        mill.dispatch_receipt_limit_hours = settings.dispatch_receipt_limit_hours
    db.flush()

    users: dict[str, User] = {}
    for role_code, name, email, status in USER_DEFINITIONS:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(name=name, email=email, role=roles[role_code], mill=None if role_code == "government_admin" else mill, status=status)
            db.add(user)
        else:
            user.name = name
            user.role = roles[role_code]
            user.mill = None if role_code == "government_admin" else mill
            user.status = status
        users[role_code] = user
    db.flush()

    suppliers: list[FarmerSupplier] = []
    for name, cnic, phone, village in SUPPLIER_DEFINITIONS:
        supplier = db.query(FarmerSupplier).filter(FarmerSupplier.mill_id == mill.id, FarmerSupplier.name == name).first()
        if not supplier:
            supplier = FarmerSupplier(mill=mill, name=name, cnic=cnic, phone=phone, village=village)
            db.add(supplier)
        else:
            supplier.cnic = cnic
            supplier.phone = phone
            supplier.village = village
        suppliers.append(supplier)
    db.flush()
    return mill, users, suppliers


def load_demo_seed_data(db: Session) -> bool:
    mill, users, suppliers = ensure_demo_reference_data(db)
    if _has_operational_data(db):
        db.commit()
        return False
    _seed_operational_data(db, mill, users, suppliers)
    db.commit()
    return True


def clear_demo_operational_data(db: Session) -> int:
    deleted = 0
    for model in OPERATIONAL_MODELS:
        deleted += db.query(model).delete(synchronize_session=False)
    db.commit()
    return deleted


def reset_demo_database(db: Session) -> None:
    clear_demo_operational_data(db)
    load_demo_seed_data(db)


def _has_operational_data(db: Session) -> bool:
    return any(db.query(model).first() is not None for model in [CaneIntake, ProductionBatch, PackagingSerial, Dispatch, BuyerReceipt, ExceptionAlert, AuditLog])


def _seed_operational_data(db: Session, mill: Mill, users: dict[str, User], suppliers: list[FarmerSupplier]) -> None:
    now = utcnow()
    operator = users["mill_operator"]
    warehouse_user = users["warehouse_manager"]
    owner = users["mill_owner"]
    fbr = users["fbr_officer"]
    auditor = users["auditor"]

    cane_intakes = [
        CaneIntake(
            delivery_id="CI-2026-0001",
            cane_ticket_id="TKT-KS-0001",
            mill=mill,
            farmer_supplier=suppliers[0],
            vehicle_number="RNH-1847",
            gross_weight_kg=28500,
            tare_weight_kg=8750,
            net_cane_weight_kg=19750,
            collection_point="Kot Samaba CP-1",
            mill_gate_timestamp=now - timedelta(hours=4),
            operator_user_id=operator.id,
            operator_name=operator.name,
            status="ACCEPTED",
        ),
        CaneIntake(
            delivery_id="CI-2026-0002",
            cane_ticket_id="TKT-SD-0002",
            mill=mill,
            farmer_supplier=suppliers[1],
            vehicle_number="RYK-7721",
            gross_weight_kg=31200,
            tare_weight_kg=9200,
            net_cane_weight_kg=22000,
            collection_point="Sadiqabad CP-2",
            mill_gate_timestamp=now - timedelta(hours=3, minutes=20),
            operator_user_id=operator.id,
            operator_name=operator.name,
            status="ACCEPTED",
        ),
        CaneIntake(
            delivery_id="CI-2026-0003",
            cane_ticket_id="TKT-LQ-0003",
            mill=mill,
            farmer_supplier=suppliers[2],
            vehicle_number="MNA-2094",
            gross_weight_kg=26800,
            tare_weight_kg=8400,
            net_cane_weight_kg=18400,
            collection_point="Liaquatpur CP-4",
            mill_gate_timestamp=now - timedelta(hours=1, minutes=15),
            operator_user_id=operator.id,
            operator_name=operator.name,
            manual_weight_override="YES",
            override_reason="Weighbridge sensor recalibrated after supervisor verification.",
            status="UNDER_REVIEW",
        ),
    ]
    db.add_all(cane_intakes)
    db.flush()

    batches = [
        ProductionBatch(
            batch_id="BATCH-2026-A01",
            mill=mill,
            shift="Morning",
            cane_input_weight_kg=41750,
            expected_sugar_output_kg=4383.75,
            actual_sugar_output_kg=4250,
            recovery_percentage=10.18,
            expected_recovery_percentage=10.5,
            variance_kg=-133.75,
            variance_percentage=-3.05,
            variance_status="WARNING",
            downtime_explanation="Short diffuser stoppage for pump inspection.",
        ),
        ProductionBatch(
            batch_id="BATCH-2026-N01",
            mill=mill,
            shift="Night",
            cane_input_weight_kg=18400,
            expected_sugar_output_kg=1932,
            actual_sugar_output_kg=1680,
            recovery_percentage=9.13,
            expected_recovery_percentage=10.5,
            variance_kg=-252,
            variance_percentage=-13.04,
            variance_status="CRITICAL",
            downtime_explanation="Abnormal low output under compliance review.",
        ),
    ]
    db.add_all(batches)
    db.flush()
    db.add_all(
        [
            ProductionBatchCaneIntake(production_batch=batches[0], cane_intake=cane_intakes[0]),
            ProductionBatchCaneIntake(production_batch=batches[0], cane_intake=cane_intakes[1]),
            ProductionBatchCaneIntake(production_batch=batches[1], cane_intake=cane_intakes[2]),
        ]
    )

    date_token = now.strftime("%Y%m%d")
    serials: list[PackagingSerial] = []
    for sequence in range(1, 71):
        status = SerialStatus.WAREHOUSED.value
        location = "WH-A / Bay 03" if sequence <= 35 else "WH-B / Bay 01"
        if 41 <= sequence <= 50 or 61 <= sequence <= 65:
            status = SerialStatus.DISPATCHED.value
        if 51 <= sequence <= 60:
            status = SerialStatus.RECEIVED.value
        serials.append(_serial_model(date_token, batches[0], sequence, status, location, now))
    for sequence in range(1, 31):
        status = SerialStatus.ACTIVATED.value
        status_time = now - timedelta(hours=27, minutes=sequence)
        void_reason = None
        supervisor_id = None
        if sequence <= 5:
            status = SerialStatus.ISSUED.value
            status_time = now - timedelta(minutes=sequence)
        elif 26 <= sequence <= 30:
            status = SerialStatus.VOIDED.value
            status_time = now - timedelta(minutes=sequence)
            void_reason = "Duplicate scan during night line test."
            supervisor_id = owner.id
        serials.append(_serial_model(date_token, batches[1], sequence, status, None, now, status_time, void_reason, supervisor_id))
    db.add_all(serials)
    db.flush()

    receipt_a_numbers = [serial.serial_number for serial in serials[:40]]
    receipt_b_numbers = [serial.serial_number for serial in serials[40:70]]
    receipts = [
        WarehouseReceipt(
            serial_range=serial_range(receipt_a_numbers),
            production_batch=batches[0],
            sku="SUGAR_50KG",
            quantity=len(receipt_a_numbers),
            total_weight_kg=len(receipt_a_numbers) * 50,
            warehouse_location="WH-A / Bay 03",
            stock_age_days=1,
            status="IN_STOCK",
            serial_numbers=to_csv(receipt_a_numbers),
            received_at=now - timedelta(hours=1, minutes=50),
        ),
        WarehouseReceipt(
            serial_range=serial_range(receipt_b_numbers),
            production_batch=batches[0],
            sku="SUGAR_50KG",
            quantity=len(receipt_b_numbers),
            total_weight_kg=len(receipt_b_numbers) * 50,
            warehouse_location="WH-B / Bay 01",
            stock_age_days=0,
            status="IN_STOCK",
            serial_numbers=to_csv(receipt_b_numbers),
            received_at=now - timedelta(hours=1, minutes=20),
        ),
    ]
    db.add_all(receipts)
    db.flush()
    for serial in serials[:40]:
        serial.warehouse_receipt = receipts[0]
    for serial in serials[40:70]:
        serial.warehouse_receipt = receipts[1]

    dispatch_1_numbers = [serial.serial_number for serial in serials[40:50]]
    dispatch_2_numbers = [serial.serial_number for serial in serials[50:60]]
    dispatch_3_numbers = [serial.serial_number for serial in serials[60:65]]
    dispatches = [
        Dispatch(
            dispatch_id="DSP-2026-0001",
            mill_id=mill.id,
            buyer="Lahore Wholesale Foods",
            buyer_order_id="LHR-DC-01",
            vehicle_number="LES-4412",
            driver_name="Imran Shah",
            invoice_number="INV-2026-9081",
            serial_range=serial_range(dispatch_1_numbers),
            serial_numbers=to_csv(dispatch_1_numbers),
            quantity=len(dispatch_1_numbers),
            dispatch_status="IN_TRANSIT",
            dispatched_at=now - timedelta(minutes=45),
        ),
        Dispatch(
            dispatch_id="DSP-2026-0002",
            mill_id=mill.id,
            buyer="Karachi Trading Co.",
            buyer_order_id="KHI-WH-07",
            vehicle_number="KHI-9014",
            driver_name="Rashid Ali",
            invoice_number="INV-2026-9082",
            serial_range=serial_range(dispatch_2_numbers),
            serial_numbers=to_csv(dispatch_2_numbers),
            quantity=len(dispatch_2_numbers),
            dispatch_status="DELIVERED",
            dispatched_at=now - timedelta(days=1),
        ),
        Dispatch(
            dispatch_id="DSP-2026-0003",
            mill_id=mill.id,
            buyer="Lahore Wholesale Foods",
            buyer_order_id="LHR-DC-02",
            vehicle_number="LES-7750",
            driver_name="Naveed Iqbal",
            invoice_number="INV-2026-9083",
            serial_range=serial_range(dispatch_3_numbers),
            serial_numbers=to_csv(dispatch_3_numbers),
            quantity=len(dispatch_3_numbers) + 1,
            dispatch_status="HELD",
            dispatched_at=now - timedelta(hours=3),
        ),
    ]
    db.add_all(dispatches)
    db.flush()
    for serial in serials[40:50]:
        serial.dispatch = dispatches[0]
    for serial in serials[50:60]:
        serial.dispatch = dispatches[1]
    for serial in serials[60:65]:
        serial.dispatch = dispatches[2]

    buyer_receipt = BuyerReceipt(
        dispatch=dispatches[1],
        buyer_name="Karachi Trading Co.",
        receipt_location="KHI-WH-07",
        received_quantity=9,
        serial_numbers=to_csv(dispatch_2_numbers[:9]),
        shortage_mismatch="Shortage 1",
        receipt_timestamp=now - timedelta(hours=8),
        status="EXCEPTION",
    )
    db.add(buyer_receipt)
    db.flush()
    for serial in serials[50:59]:
        serial.buyer_receipt = buyer_receipt

    db.add_all(
        [
            _exception(ExceptionType.RECOVERY_VARIANCE_WARNING, "ProductionBatch", "BATCH-2026-A01", "Actual output is 3.05% below expected recovery threshold.", "MEDIUM", now - timedelta(hours=2)),
            _exception(ExceptionType.RECOVERY_VARIANCE_CRITICAL, "ProductionBatch", "BATCH-2026-N01", "Actual output is 13.04% below expected recovery threshold.", "CRITICAL", now - timedelta(hours=1, minutes=20)),
            _exception(ExceptionType.SERIAL_GAP, "PackagingSerial", _serial(date_token, "BATCH-2026-N01", 6), "Night batch activation skipped several issued serials.", "HIGH", now - timedelta(hours=1)),
            _exception(ExceptionType.SERIAL_OUT_OF_ORDER, "PackagingSerial", _serial(date_token, "BATCH-2026-N01", 8), "Serial activation occurred while lower sequences remained ISSUED.", "MEDIUM", now - timedelta(minutes=58)),
            _exception(ExceptionType.ACTIVATED_NOT_WAREHOUSED, "PackagingSerial", _serial(date_token, "BATCH-2026-N01", 10), "Activated serial has not been warehoused after 24 hours.", "HIGH", now - timedelta(minutes=54)),
            _exception(ExceptionType.DISPATCH_WITHOUT_INVOICE, "Dispatch", "DSP-2026-0003", "A dispatch attempt without invoice evidence was blocked before release.", "CRITICAL", now - timedelta(minutes=50)),
            _exception(ExceptionType.DISPATCH_QUANTITY_MISMATCH, "Dispatch", "DSP-2026-0003", "Dispatch quantity is one bag higher than scanned serial count.", "HIGH", now - timedelta(minutes=45)),
            _exception(ExceptionType.RECEIPT_SHORTAGE, "Dispatch", "DSP-2026-0002", "Buyer receipt is missing one dispatched serial.", "HIGH", now - timedelta(minutes=40)),
            _exception(ExceptionType.RECEIPT_MISSING, "Dispatch", "DSP-2026-0001", "Buyer acknowledgement has not been received for pending dispatch.", "LOW", now - timedelta(minutes=35)),
            _exception(ExceptionType.MANUAL_OVERRIDE, "CaneIntake", "CI-2026-0003", "Manual tare override was entered after weighbridge recalibration.", "HIGH", now - timedelta(minutes=25)),
        ]
    )
    db.flush()

    audit = AuditService(db)
    audit_events = [
        (operator, "CREATE_CANE_INTAKE", "CaneIntake", "CI-2026-0001", {"net_cane_weight_kg": 19750}, "Gate intake accepted with weighbridge evidence."),
        (operator, "CREATE_CANE_INTAKE", "CaneIntake", "CI-2026-0002", {"net_cane_weight_kg": 22000}, "Gate intake accepted with weighbridge evidence."),
        (operator, "MANUAL_OVERRIDE", "CaneIntake", "CI-2026-0003", {"override_reason": cane_intakes[2].override_reason}, "Manual tare override recorded."),
        (operator, "CREATE_PRODUCTION_BATCH", "ProductionBatch", "BATCH-2026-A01", {"variance_status": "WARNING"}, "Morning batch mass balance calculated."),
        (operator, "CREATE_PRODUCTION_BATCH", "ProductionBatch", "BATCH-2026-N01", {"variance_status": "CRITICAL"}, "Night batch mass balance calculated."),
        (operator, "GENERATE_SERIALS", "ProductionBatch", "BATCH-2026-A01", {"quantity": 70}, "Morning packaging serials issued."),
        (operator, "GENERATE_SERIALS", "ProductionBatch", "BATCH-2026-N01", {"quantity": 30}, "Night packaging serials issued."),
    ]
    for serial in serials[:5]:
        audit_events.append((operator, "ACTIVATE_SERIAL", "PackagingSerial", serial.serial_number, {"status": serial.status}, "Serial activation event captured."))
    for serial in serials[:8]:
        audit_events.append((warehouse_user, "WAREHOUSE_SERIAL", "PackagingSerial", serial.serial_number, {"warehouse_location": serial.warehouse_location}, "Serial warehoused."))
    audit_events.extend(
        [
            (warehouse_user, "CREATE_WAREHOUSE_RECEIPT", "WarehouseReceipt", str(receipts[0].id), {"quantity": receipts[0].quantity}, "Warehouse receipt created."),
            (warehouse_user, "CREATE_WAREHOUSE_RECEIPT", "WarehouseReceipt", str(receipts[1].id), {"quantity": receipts[1].quantity}, "Warehouse receipt created."),
            (warehouse_user, "CREATE_DISPATCH", "Dispatch", "DSP-2026-0001", {"quantity": 10}, "Dispatch released."),
            (warehouse_user, "CREATE_DISPATCH", "Dispatch", "DSP-2026-0002", {"quantity": 10}, "Dispatch released."),
            (warehouse_user, "BLOCK_DISPATCH", "Dispatch", "DSP-2026-0003", {"reason": "missing invoice"}, "Dispatch attempt without invoice was blocked and held for review."),
            (warehouse_user, "CREATE_BUYER_RECEIPT", "BuyerReceipt", "DSP-2026-0002", {"received_quantity": 9}, "Buyer receipt shortage captured."),
            (fbr, "EXCEPTION_IN_REVIEW", "ExceptionAlert", "DISPATCH_WITHOUT_INVOICE", {"status": "IN_REVIEW"}, "FBR officer opened review."),
            (auditor, "REVIEW_NOTE", "ExceptionAlert", "RECEIPT_SHORTAGE", {"note": "Receipt evidence requested."}, "Auditor added review note."),
            (owner, "VOID_SERIAL", "PackagingSerial", serials[-1].serial_number, {"reason": serials[-1].void_reason}, "Owner approved voided serial."),
        ]
    )
    for actor, action, entity_type, entity_id, new_value, detail in audit_events:
        audit.log(
            actor_user_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            new_value=new_value,
            detail=detail,
        )


def _serial_model(
    date_token: str,
    batch: ProductionBatch,
    sequence: int,
    status: str,
    location: str | None,
    now: datetime,
    status_time: datetime | None = None,
    void_reason: str | None = None,
    supervisor_id: int | None = None,
) -> PackagingSerial:
    status_time = status_time or now - timedelta(hours=1, minutes=sequence % 40)
    return PackagingSerial(
        serial_number=_serial(date_token, batch.batch_id, sequence),
        production_batch=batch,
        bag_weight_kg=50,
        sku="SUGAR_50KG",
        packaging_line="Line A" if batch.batch_id.endswith("A01") else "Line C",
        sequence_number=sequence,
        status=status,
        timestamp=now - timedelta(hours=2, minutes=sequence),
        status_updated_at=status_time,
        warehouse_location=location,
        void_reason=void_reason,
        supervisor_approval_user_id=supervisor_id,
    )


def _serial(date_token: str, batch_id: str, sequence: int) -> str:
    return f"MT-PK-SUG-MEHRAB-{date_token}-{batch_id}-{sequence:06d}"


def _exception(
    exception_type: ExceptionType,
    related_entity_type: str,
    related_entity_id: str,
    description: str,
    severity: str,
    detected_at: datetime,
) -> ExceptionAlert:
    title = exception_type.value.replace("_", " ").title()
    return ExceptionAlert(
        type=exception_type.value,
        alert_type=exception_type.value,
        severity=severity,
        title=title,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        related_entity=f"{related_entity_type}:{related_entity_id}",
        description=description,
        suggested_action="Review compliance evidence and resolve with supervisor approval.",
        status=ExceptionStatus.OPEN.value,
        detected_at=detected_at,
        created_at=detected_at,
    )
