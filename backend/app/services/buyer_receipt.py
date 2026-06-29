from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import DomainError, ExceptionType, SerialStatus
from app.models import BuyerReceipt
from app.repositories.core import BuyerReceiptRepository, DispatchRepository, MillRepository, SerialRepository
from app.schemas import BuyerReceiptCreate
from app.services.audit import AuditService
from app.services.exceptions import ExceptionService
from app.utils import parse_csv, to_csv, utcnow


class BuyerReceiptService:
    def __init__(self, db: Session):
        self.db = db
        self.mills = MillRepository(db)
        self.dispatches = DispatchRepository(db)
        self.receipts = BuyerReceiptRepository(db)
        self.serials = SerialRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def create(self, payload: BuyerReceiptCreate) -> BuyerReceipt:
        dispatch = self.dispatches.get_by_dispatch_id(payload.dispatch_id)
        if not dispatch:
            raise DomainError("Dispatch not found", status_code=404)

        if self.receipts.exists_for_dispatch(dispatch.id):
            self.exceptions.create(
                exception_type=ExceptionType.MANUAL_OVERRIDE,
                related_entity_type="Dispatch",
                related_entity_id=dispatch.dispatch_id,
                description="Duplicate buyer receipt was attempted for this dispatch.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Buyer receipt already exists for this dispatch.")

        if payload.buyer_name != dispatch.buyer:
            self.exceptions.create(
                exception_type=ExceptionType.RECEIPT_WRONG_BUYER,
                related_entity_type="Dispatch",
                related_entity_id=dispatch.dispatch_id,
                description=f"Receipt buyer {payload.buyer_name} does not match dispatch buyer {dispatch.buyer}.",
                actor_user_id=payload.actor_user_id,
            )
            self.db.commit()
            raise DomainError("Buyer receipt does not match dispatch buyer.")

        if payload.receipt_location and dispatch.buyer_order_id and payload.receipt_location != dispatch.buyer_order_id:
            self.exceptions.create(
                exception_type=ExceptionType.RECEIPT_WRONG_BUYER,
                related_entity_type="Dispatch",
                related_entity_id=dispatch.dispatch_id,
                description="Receipt location does not match the dispatch buyer order destination.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )

        dispatched_numbers = set(parse_csv(dispatch.serial_numbers))
        received_numbers = set(payload.serial_numbers)
        shortage = sorted(dispatched_numbers - received_numbers)
        extra = sorted(received_numbers - dispatched_numbers)
        matched_numbers = sorted(dispatched_numbers & received_numbers)

        if shortage:
            self.exceptions.create(
                exception_type=ExceptionType.RECEIPT_SHORTAGE,
                related_entity_type="Dispatch",
                related_entity_id=dispatch.dispatch_id,
                description=f"Buyer receipt is missing {len(shortage)} dispatched serial(s).",
                actor_user_id=payload.actor_user_id,
            )
        if extra:
            self.exceptions.create(
                exception_type=ExceptionType.RECEIPT_EXTRA_SERIAL,
                related_entity_type="Dispatch",
                related_entity_id=dispatch.dispatch_id,
                description=f"Buyer receipt includes {len(extra)} serial(s) not dispatched to this buyer.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )

        serials = self.serials.get_by_numbers(matched_numbers)
        invalid_status = [item.serial_number for item in serials if item.status != SerialStatus.DISPATCHED.value]
        if invalid_status:
            raise DomainError(f"Only DISPATCHED serials can be received. Invalid serials: {', '.join(invalid_status)}.")

        mismatch_text = "None"
        if shortage and extra:
            mismatch_text = f"Shortage {len(shortage)}, extra {len(extra)}"
        elif shortage:
            mismatch_text = f"Shortage {len(shortage)}"
        elif extra:
            mismatch_text = f"Extra {len(extra)}"

        receipt = BuyerReceipt(
            dispatch=dispatch,
            buyer_name=payload.buyer_name,
            receipt_location=payload.receipt_location,
            received_quantity=len(matched_numbers),
            serial_numbers=to_csv(matched_numbers),
            shortage_mismatch=mismatch_text,
            status="CONFIRMED" if not shortage and not extra else "EXCEPTION",
            receipt_timestamp=utcnow(),
        )
        self.receipts.create(receipt)

        for serial in serials:
            old_value = {"status": serial.status}
            serial.status = SerialStatus.RECEIVED.value
            serial.status_updated_at = utcnow()
            serial.buyer_receipt = receipt
            self.audit.log(
                actor_user_id=payload.actor_user_id,
                action="RECEIVE_SERIAL",
                entity_type="PackagingSerial",
                entity_id=serial.serial_number,
                old_value=old_value,
                new_value={"status": serial.status, "receipt_id": receipt.id},
                detail="Serial matched to buyer receipt.",
            )

        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action="CREATE_BUYER_RECEIPT",
            entity_type="BuyerReceipt",
            entity_id=dispatch.dispatch_id,
            new_value={
                "buyer_name": receipt.buyer_name,
                "received_quantity": receipt.received_quantity,
                "shortage_mismatch": receipt.shortage_mismatch,
            },
            detail="Buyer receipt reconciled against dispatched serials.",
        )
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def scan_missing_receipts(self) -> None:
        mill = self.mills.get_demo_mill()
        limit_hours = mill.dispatch_receipt_limit_hours if mill else settings.dispatch_receipt_limit_hours
        cutoff = utcnow() - timedelta(hours=limit_hours)
        for dispatch in self.dispatches.pending_receipt_before(cutoff):
            self.exceptions.create(
                exception_type=ExceptionType.RECEIPT_MISSING,
                related_entity_type="Dispatch",
                related_entity_id=dispatch.dispatch_id,
                description=f"Dispatch has no buyer receipt after {limit_hours} hours.",
            )
