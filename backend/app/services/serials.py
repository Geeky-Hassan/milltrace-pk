from sqlalchemy.orm import Session

from app.domain import DomainError, ExceptionType, SERIAL_FORWARD_TRANSITIONS, SerialStatus, normalize_serial_status
from app.models import PackagingSerial
from app.repositories.core import ProductionBatchRepository, SerialRepository
from app.schemas import PackagingSerialCreate, SerialGenerateRequest, SerialTransitionRequest
from app.services.audit import AuditService
from app.services.exceptions import ExceptionService
from app.utils import utcnow


class SerialService:
    def __init__(self, db: Session):
        self.db = db
        self.batches = ProductionBatchRepository(db)
        self.repo = SerialRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def generate(self, payload: SerialGenerateRequest) -> list[PackagingSerial]:
        batch = self.batches.get_by_batch_id(payload.batch_id)
        if not batch:
            raise DomainError("Production batch not found", status_code=404)
        if payload.quantity <= 0:
            raise DomainError("Serial generation quantity must be positive.")

        max_sequence = self.repo.max_sequence_for_batch(batch.id)
        start_sequence = payload.start_sequence or max_sequence + 1
        if start_sequence > max_sequence + 1:
            self.exceptions.create(
                exception_type=ExceptionType.SERIAL_GAP,
                related_entity_type="ProductionBatch",
                related_entity_id=batch.batch_id,
                description=f"Serial generation skipped from sequence {max_sequence + 1} to {start_sequence}.",
                actor_user_id=payload.actor_user_id,
            )

        serials: list[PackagingSerial] = []
        for offset in range(payload.quantity):
            sequence = start_sequence + offset
            serial_number = self._format_serial(batch.mill.code, batch.batch_id, sequence)
            if self.repo.exists(serial_number):
                self.exceptions.create(
                    exception_type=ExceptionType.SERIAL_DUPLICATE,
                    related_entity_type="PackagingSerial",
                    related_entity_id=serial_number,
                    description="Generated serial already exists.",
                    actor_user_id=payload.actor_user_id,
                    allow_duplicate=True,
                )
                self.db.commit()
                raise DomainError(f"Duplicate serial detected: {serial_number}.")
            serials.append(
                PackagingSerial(
                    serial_number=serial_number,
                    production_batch=batch,
                    bag_weight_kg=payload.bag_weight_kg,
                    sku=payload.sku,
                    packaging_line=payload.packaging_line,
                    sequence_number=sequence,
                    status=SerialStatus.ISSUED.value,
                    timestamp=utcnow(),
                    status_updated_at=utcnow(),
                )
            )

        self.repo.create_many(serials)
        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action="GENERATE_SERIALS",
            entity_type="ProductionBatch",
            entity_id=batch.batch_id,
            new_value={"quantity": payload.quantity, "serials": [item.serial_number for item in serials]},
            detail="Packaging serials issued.",
        )
        self.db.commit()
        for serial in serials:
            self.db.refresh(serial)
        return serials

    def create_manual(self, payload: PackagingSerialCreate) -> PackagingSerial:
        batch = self.batches.get_by_batch_id(payload.batch_id)
        if not batch:
            raise DomainError("Production batch not found", status_code=404)
        if self.repo.exists(payload.serial_number):
            self.exceptions.create(
                exception_type=ExceptionType.SERIAL_DUPLICATE,
                related_entity_type="PackagingSerial",
                related_entity_id=payload.serial_number,
                description="Manual serial already exists.",
                actor_user_id=payload.actor_user_id,
            )
            self.db.commit()
            raise DomainError(f"Duplicate serial detected: {payload.serial_number}.")
        sequence = payload.sequence_number or self.repo.max_sequence_for_batch(batch.id) + 1
        serial = PackagingSerial(
            serial_number=payload.serial_number,
            production_batch=batch,
            bag_weight_kg=payload.bag_weight_kg,
            sku=payload.sku,
            packaging_line=payload.packaging_line,
            sequence_number=sequence,
            status=normalize_serial_status(payload.status).value,
            timestamp=utcnow(),
            status_updated_at=utcnow(),
        )
        self.repo.create_many([serial])
        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action="GENERATE_SERIALS",
            entity_type="PackagingSerial",
            entity_id=serial.serial_number,
            new_value={"serial_number": serial.serial_number, "status": serial.status},
            detail="Manual packaging serial created.",
        )
        self.db.commit()
        self.db.refresh(serial)
        return serial

    def transition(self, serial_number: str, payload: SerialTransitionRequest) -> PackagingSerial:
        serial = self.repo.get_by_number(serial_number)
        if not serial:
            raise DomainError("Packaging serial not found", status_code=404)
        current = normalize_serial_status(serial.status)
        target = normalize_serial_status(payload.target_status)
        old_value = {"status": serial.status}

        if target == SerialStatus.VOIDED:
            if not payload.reason or not payload.supervisor_user_id:
                self.exceptions.create(
                    exception_type=ExceptionType.SERIAL_INVALID_TRANSITION,
                    related_entity_type="PackagingSerial",
                    related_entity_id=serial.serial_number,
                    description="Voiding a serial requires reason and supervisor approval.",
                    actor_user_id=payload.actor_user_id,
                )
                self.db.commit()
                raise DomainError("Voiding a serial requires reason and supervisor approval.")
            serial.void_reason = payload.reason
            serial.supervisor_approval_user_id = payload.supervisor_user_id
            audit_action = "VOID_SERIAL"
        else:
            expected_target = SERIAL_FORWARD_TRANSITIONS.get(current)
            if expected_target != target:
                self.exceptions.create(
                    exception_type=ExceptionType.SERIAL_INVALID_TRANSITION,
                    related_entity_type="PackagingSerial",
                    related_entity_id=serial.serial_number,
                    description=f"Serial cannot move from {current.value} to {target.value}.",
                    actor_user_id=payload.actor_user_id,
                )
                self.db.commit()
                raise DomainError(f"Invalid serial transition from {current.value} to {target.value}.")
            audit_action = f"{target.value}_SERIAL"

        if target == SerialStatus.ACTIVATED:
            earlier_issued = [
                item
                for item in self.repo.list_for_batch(serial.production_batch_id)
                if item.sequence_number < serial.sequence_number and item.status == SerialStatus.ISSUED.value
            ]
            if earlier_issued:
                self.exceptions.create(
                    exception_type=ExceptionType.SERIAL_OUT_OF_ORDER,
                    related_entity_type="PackagingSerial",
                    related_entity_id=serial.serial_number,
                    description="Serial activated while lower sequence serials remain ISSUED.",
                    actor_user_id=payload.actor_user_id,
                )

        serial.status = target.value
        serial.status_updated_at = utcnow()
        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action=audit_action,
            entity_type="PackagingSerial",
            entity_id=serial.serial_number,
            old_value=old_value,
            new_value={"status": serial.status},
            detail=payload.reason or f"Serial moved to {serial.status}.",
        )
        self.db.commit()
        self.db.refresh(serial)
        return serial

    @staticmethod
    def _format_serial(mill_code: str, batch_id: str, sequence: int) -> str:
        date_token = utcnow().strftime("%Y%m%d")
        return f"MT-PK-SUG-{mill_code}-{date_token}-{batch_id}-{sequence:06d}"
