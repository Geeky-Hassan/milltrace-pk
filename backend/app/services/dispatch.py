from sqlalchemy.orm import Session

from app.domain import DomainError, ExceptionType, SerialStatus
from app.models import Dispatch
from app.repositories.core import DispatchRepository, MillRepository, SerialRepository
from app.schemas import DispatchCreate
from app.services.audit import AuditService
from app.services.exceptions import ExceptionService
from app.utils import serial_range, to_csv, utcnow


class DispatchService:
    def __init__(self, db: Session):
        self.db = db
        self.mills = MillRepository(db)
        self.serials = SerialRepository(db)
        self.repo = DispatchRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def create(self, payload: DispatchCreate) -> Dispatch:
        mill = self.mills.get_demo_mill()
        if not payload.buyer.strip():
            raise DomainError("Dispatch buyer is required.")
        if not payload.vehicle_number.strip():
            raise DomainError("Dispatch vehicle number is required.")
        if not payload.serial_numbers:
            raise DomainError("Dispatch requires a serial list.")
        serials = self.serials.get_by_numbers(payload.serial_numbers)
        found_numbers = {item.serial_number for item in serials}
        missing = [serial for serial in payload.serial_numbers if serial not in found_numbers]
        invalid = [item.serial_number for item in serials if item.status != SerialStatus.WAREHOUSED.value]

        for serial_number in missing + invalid:
            self.exceptions.create(
                exception_type=ExceptionType.DISPATCH_INVALID_SERIAL,
                related_entity_type="PackagingSerial",
                related_entity_id=serial_number,
                description="Dispatch attempted with a serial that is missing or not WAREHOUSED.",
                actor_user_id=payload.actor_user_id,
            )
        if missing or invalid:
            self.db.commit()
            raise DomainError(f"Dispatch includes invalid serials: {', '.join(missing + invalid)}.")

        if not payload.invoice_number:
            self.exceptions.create(
                exception_type=ExceptionType.DISPATCH_WITHOUT_INVOICE,
                related_entity_type="Dispatch",
                related_entity_id=payload.vehicle_number,
                description="Dispatch was blocked because invoice evidence is missing.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Dispatch requires an invoice number before stock can leave warehouse.")

        if payload.quantity != len(payload.serial_numbers):
            self.exceptions.create(
                exception_type=ExceptionType.DISPATCH_QUANTITY_MISMATCH,
                related_entity_type="Dispatch",
                related_entity_id=payload.invoice_number,
                description=f"Dispatch quantity {payload.quantity} does not match serial count {len(payload.serial_numbers)}.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )

        dispatch = Dispatch(
            dispatch_id=self.repo.next_dispatch_id(),
            mill_id=mill.id if mill else None,
            buyer=payload.buyer,
            buyer_order_id=payload.buyer_order_id,
            vehicle_number=payload.vehicle_number,
            driver_name=payload.driver_name,
            invoice_number=payload.invoice_number or None,
            serial_range=serial_range(payload.serial_numbers),
            serial_numbers=to_csv(payload.serial_numbers),
            quantity=payload.quantity,
            dispatch_status="IN_TRANSIT",
            dispatched_at=utcnow(),
        )
        self.repo.create(dispatch)
        for serial in serials:
            old_value = {"status": serial.status}
            serial.status = SerialStatus.DISPATCHED.value
            serial.status_updated_at = utcnow()
            serial.dispatch = dispatch
            self.audit.log(
                actor_user_id=payload.actor_user_id,
                action="DISPATCH_SERIAL",
                entity_type="PackagingSerial",
                entity_id=serial.serial_number,
                old_value=old_value,
                new_value={"status": serial.status, "dispatch_id": dispatch.dispatch_id},
                detail="Serial released from warehouse into dispatch.",
            )

        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action="CREATE_DISPATCH",
            entity_type="Dispatch",
            entity_id=dispatch.dispatch_id,
            new_value={
                "buyer": dispatch.buyer,
                "invoice_number": dispatch.invoice_number,
                "quantity": dispatch.quantity,
                "serial_numbers": payload.serial_numbers,
            },
            detail="Dispatch created with warehouse serial validation.",
        )
        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch
