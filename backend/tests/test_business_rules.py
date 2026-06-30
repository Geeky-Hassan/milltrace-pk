import pytest

from app.domain import DomainError, ExceptionType, SerialStatus
from app.db.seed import clear_demo_operational_data, load_demo_seed_data
from app.models import ExceptionAlert, PackagingSerial
from app.schemas import (
    BuyerReceiptCreate,
    CaneIntakeCreate,
    DispatchCreate,
    ProductionBatchCreate,
    SerialGenerateRequest,
    SerialTransitionRequest,
    WarehouseReceiptCreate,
)
from app.services.audit import AuditService
from app.services.buyer_receipt import BuyerReceiptService
from app.services.cane_intake import CaneIntakeService
from app.services.dispatch import DispatchService
from app.services.production import ProductionService
from app.services.serials import SerialService
from app.services.warehouse import WarehouseService


def test_cane_intake_rejects_invalid_weight_and_persists_exception(db_session):
    service = CaneIntakeService(db_session)

    with pytest.raises(DomainError, match="Gross weight must be greater"):
        service.create(
            CaneIntakeCreate(
                farmer_supplier_name="Test Grower",
                vehicle_number="TEST-001",
                gross_weight_kg=1000,
                tare_weight_kg=1000,
                collection_point="CP-Test",
                operator_name="Bilal Ahmed",
                operator_user_id=2,
            )
        )

    alert = db_session.query(ExceptionAlert).filter(ExceptionAlert.type == ExceptionType.WEIGHT_INVALID.value).first()
    assert alert is not None
    assert alert.status == "OPEN"


def test_production_batch_links_intakes_and_creates_variance_exception(db_session):
    intake_a = CaneIntakeService(db_session).create(
        CaneIntakeCreate(
            farmer_supplier_name="Test Grower A",
            vehicle_number="TST-101",
            cane_ticket_id="TST-TKT-101",
            gross_weight_kg=20000,
            tare_weight_kg=5000,
            collection_point="CP-Test",
            operator_name="Bilal Ahmed",
            operator_user_id=2,
        )
    )
    intake_b = CaneIntakeService(db_session).create(
        CaneIntakeCreate(
            farmer_supplier_name="Test Grower B",
            vehicle_number="TST-102",
            cane_ticket_id="TST-TKT-102",
            gross_weight_kg=21000,
            tare_weight_kg=5000,
            collection_point="CP-Test",
            operator_name="Bilal Ahmed",
            operator_user_id=2,
        )
    )
    batch = ProductionService(db_session).create(
        ProductionBatchCreate(
            shift="Test Shift",
            cane_intake_ids=[intake_a.id, intake_b.id],
            actual_sugar_output_kg=2500,
            actor_user_id=2,
        )
    )

    assert batch.cane_input_weight_kg == 31000
    assert batch.expected_sugar_output_kg == pytest.approx(3255)
    assert batch.recovery_percentage == pytest.approx(8.06)
    assert batch.variance_status == "CRITICAL"
    assert len(batch.cane_intake_links) == 2
    assert (
        db_session.query(ExceptionAlert)
        .filter(ExceptionAlert.type == ExceptionType.RECOVERY_VARIANCE_CRITICAL.value)
        .filter(ExceptionAlert.related_entity_id == batch.batch_id)
        .first()
        is not None
    )


def test_serial_generation_gap_and_lifecycle_validation(db_session):
    serials = SerialService(db_session).generate(
        SerialGenerateRequest(
            batch_id="PB-MBR-NGT-26C14",
            quantity=2,
            start_sequence=40,
            bag_weight_kg=50,
            packaging_line="Line A",
            actor_user_id=2,
        )
    )

    assert [serial.sequence_number for serial in serials] == [40, 41]
    assert db_session.query(ExceptionAlert).filter(ExceptionAlert.type == ExceptionType.SERIAL_GAP.value).first()

    with pytest.raises(DomainError, match="Invalid serial transition"):
        SerialService(db_session).transition(
            serials[0].serial_number,
            SerialTransitionRequest(target_status=SerialStatus.WAREHOUSED.value, actor_user_id=2),
        )

    assert (
        db_session.query(ExceptionAlert)
        .filter(ExceptionAlert.type == ExceptionType.SERIAL_INVALID_TRANSITION.value)
        .filter(ExceptionAlert.related_entity_id == serials[0].serial_number)
        .first()
        is not None
    )


def test_serial_generation_derives_quantity_from_batch_output(db_session):
    intake = CaneIntakeService(db_session).create(
        CaneIntakeCreate(
            farmer_supplier_name="Auto Bag Grower",
            vehicle_number="BAG-101",
            cane_ticket_id="BAG-TKT-101",
            gross_weight_kg=40000,
            tare_weight_kg=10000,
            collection_point="CP-Test",
            operator_name="Bilal Ahmed",
            operator_user_id=2,
        )
    )
    batch = ProductionService(db_session).create(
        ProductionBatchCreate(
            shift="Auto Bags",
            cane_intake_ids=[intake.id],
            actual_sugar_output_kg=3150,
            actor_user_id=2,
        )
    )

    serials = SerialService(db_session).generate(
        SerialGenerateRequest(
            batch_id=batch.batch_id,
            packaging_line="Line Auto",
            actor_user_id=2,
        )
    )

    assert len(serials) == 63
    assert all(serial.bag_weight_kg == 50 for serial in serials)
    assert serials[0].sequence_number == 1
    assert serials[-1].sequence_number == 63


def test_warehouse_requires_activated_serials(db_session):
    warehoused = db_session.query(PackagingSerial).filter(PackagingSerial.status == SerialStatus.WAREHOUSED.value).first()

    with pytest.raises(DomainError, match="Only ACTIVATED"):
        WarehouseService(db_session).create_receipt(
            WarehouseReceiptCreate(
                serial_numbers=[warehoused.serial_number],
                warehouse_location="WH-Z / Reject",
                actor_user_id=3,
            )
        )

    assert (
        db_session.query(ExceptionAlert)
        .filter(ExceptionAlert.type == ExceptionType.SERIAL_INVALID_TRANSITION.value)
        .filter(ExceptionAlert.related_entity_id == warehoused.serial_number)
        .first()
        is not None
    )


def test_dispatch_updates_serials_and_flags_quantity_mismatch(db_session):
    serial = db_session.query(PackagingSerial).filter(PackagingSerial.status == SerialStatus.WAREHOUSED.value).first()
    dispatch = DispatchService(db_session).create(
        DispatchCreate(
            buyer="Test Buyer",
            vehicle_number="TST-100",
            driver_name="Test Driver",
            invoice_number="INV-TEST-100",
            serial_numbers=[serial.serial_number],
            quantity=2,
            actor_user_id=3,
        )
    )

    db_session.refresh(serial)
    assert dispatch.dispatch_id.startswith("DS-")
    assert serial.status == SerialStatus.DISPATCHED.value
    assert db_session.query(ExceptionAlert).filter(ExceptionAlert.type == ExceptionType.DISPATCH_QUANTITY_MISMATCH.value).first()


def test_dispatch_without_invoice_auto_generates_demo_invoice(db_session):
    serial = db_session.query(PackagingSerial).filter(PackagingSerial.status == SerialStatus.WAREHOUSED.value).first()

    dispatch = DispatchService(db_session).create(
        DispatchCreate(
            buyer="No Invoice Buyer",
            vehicle_number="NOINV-100",
            driver_name="Test Driver",
            invoice_number=None,
            serial_numbers=[serial.serial_number],
            quantity=1,
            actor_user_id=3,
        )
    )

    db_session.refresh(serial)
    assert serial.status == SerialStatus.DISPATCHED.value
    assert dispatch.invoice_number.startswith("MTINV-MBR-")


def test_buyer_receipt_detects_shortage_and_updates_matched_serials(db_session):
    serials = db_session.query(PackagingSerial).filter(PackagingSerial.status == SerialStatus.WAREHOUSED.value).limit(2).all()
    dispatch = DispatchService(db_session).create(
        DispatchCreate(
            buyer="Receipt Buyer",
            vehicle_number="TST-200",
            driver_name="Receipt Driver",
            invoice_number="INV-TEST-200",
            serial_numbers=[serial.serial_number for serial in serials],
            quantity=2,
            actor_user_id=3,
        )
    )

    receipt = BuyerReceiptService(db_session).create(
        BuyerReceiptCreate(
            dispatch_id=dispatch.dispatch_id,
            buyer_name="Receipt Buyer",
            serial_numbers=[serials[0].serial_number],
            actor_user_id=3,
        )
    )

    db_session.refresh(serials[0])
    db_session.refresh(serials[1])
    assert receipt.received_quantity == 1
    assert receipt.shortage_mismatch == "Shortage 1"
    assert serials[0].status == SerialStatus.RECEIVED.value
    assert serials[1].status == SerialStatus.DISPATCHED.value
    assert db_session.query(ExceptionAlert).filter(ExceptionAlert.type == ExceptionType.RECEIPT_SHORTAGE.value).first()


def test_cane_intake_rejects_duplicate_ticket_and_vehicle_window(db_session):
    service = CaneIntakeService(db_session)
    service.create(
        CaneIntakeCreate(
            farmer_supplier_name="Window Grower",
            vehicle_number="DUP-101",
            cane_ticket_id="DUP-TKT-101",
            gross_weight_kg=18000,
            tare_weight_kg=5000,
            collection_point="CP-Test",
            operator_name="Bilal Ahmed",
            operator_user_id=2,
        )
    )

    with pytest.raises(DomainError, match="already been used"):
        service.create(
            CaneIntakeCreate(
                farmer_supplier_name="Window Grower",
                vehicle_number="DUP-102",
                cane_ticket_id="DUP-TKT-101",
                gross_weight_kg=18100,
                tare_weight_kg=5000,
                collection_point="CP-Test",
                operator_name="Bilal Ahmed",
                operator_user_id=2,
            )
        )

    with pytest.raises(DomainError, match="Duplicate vehicle"):
        service.create(
            CaneIntakeCreate(
                farmer_supplier_name="Window Grower",
                vehicle_number="DUP-101",
                cane_ticket_id="DUP-TKT-102",
                gross_weight_kg=18200,
                tare_weight_kg=5000,
                collection_point="CP-Test",
                operator_name="Bilal Ahmed",
                operator_user_id=2,
            )
        )


def test_production_rejects_missing_intake_and_unreasonable_recovery(db_session):
    with pytest.raises(DomainError, match="must link"):
        ProductionService(db_session).create(
            ProductionBatchCreate(shift="No Intake", actual_sugar_output_kg=1200, actor_user_id=2)
        )

    intake = CaneIntakeService(db_session).create(
        CaneIntakeCreate(
            farmer_supplier_name="High Recovery Grower",
            vehicle_number="HIGH-101",
            cane_ticket_id="HIGH-TKT-101",
            gross_weight_kg=15000,
            tare_weight_kg=5000,
            collection_point="CP-Test",
            operator_name="Bilal Ahmed",
            operator_user_id=2,
        )
    )
    with pytest.raises(DomainError, match="physically reasonable"):
        ProductionService(db_session).create(
            ProductionBatchCreate(
                shift="High Recovery",
                cane_intake_ids=[intake.id],
                actual_sugar_output_kg=2000,
                actor_user_id=2,
            )
        )


def test_warehouse_quantity_mismatch_creates_exception(db_session):
    serial = db_session.query(PackagingSerial).filter(PackagingSerial.status == SerialStatus.ACTIVATED.value).first()

    with pytest.raises(DomainError, match="quantity does not match"):
        WarehouseService(db_session).create_receipt(
            WarehouseReceiptCreate(
                serial_numbers=[serial.serial_number],
                warehouse_location="WH-A / Bay 03",
                quantity=2,
                actor_user_id=3,
            )
        )

    assert db_session.query(ExceptionAlert).filter(ExceptionAlert.type == ExceptionType.MANUAL_OVERRIDE.value).first()


def test_exception_resolution_requires_reason_and_audit_hash_chain(db_session):
    alert = db_session.query(ExceptionAlert).first()

    with pytest.raises(ValueError, match="requires a reason"):
        from app.services.exceptions import ExceptionService

        ExceptionService(db_session).resolve(alert.id, actor_user_id=6)

    audit = AuditService(db_session)
    first = audit.log(actor_user_id=6, action="REVIEW_NOTE", entity_type="ExceptionAlert", entity_id=alert.id, detail="First note")
    second = audit.log(actor_user_id=6, action="REVIEW_NOTE", entity_type="ExceptionAlert", entity_id=alert.id, detail="Second note")

    assert first.event_hash
    assert second.previous_event_hash == first.event_hash
    assert second.event_hash != first.event_hash


def test_seed_clear_preserves_reference_data_and_load_is_idempotent(db_session):
    deleted = clear_demo_operational_data(db_session)

    assert deleted > 0
    assert db_session.query(PackagingSerial).count() == 0
    assert db_session.query(ExceptionAlert).count() == 0
    assert load_demo_seed_data(db_session) is True
    first_serial_count = db_session.query(PackagingSerial).count()
    assert first_serial_count == 100
    assert load_demo_seed_data(db_session) is False
    assert db_session.query(PackagingSerial).count() == first_serial_count
