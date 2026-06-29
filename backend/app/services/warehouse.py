from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import DomainError, ExceptionType, SerialStatus
from app.models import WarehouseReceipt
from app.repositories.core import MillRepository, SerialRepository, WarehouseRepository
from app.schemas import WarehouseReceiptCreate
from app.services.audit import AuditService
from app.services.exceptions import ExceptionService
from app.utils import serial_range, to_csv, utcnow


class WarehouseService:
    def __init__(self, db: Session):
        self.db = db
        self.mills = MillRepository(db)
        self.serials = SerialRepository(db)
        self.repo = WarehouseRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def create_receipt(self, payload: WarehouseReceiptCreate) -> WarehouseReceipt:
        serials = self.serials.get_by_numbers(payload.serial_numbers)
        found_numbers = {item.serial_number for item in serials}
        missing = [serial for serial in payload.serial_numbers if serial not in found_numbers]
        if missing:
            raise DomainError(f"Warehouse receipt includes unknown serials: {', '.join(missing)}.", status_code=404)

        invalid = [item.serial_number for item in serials if item.status != SerialStatus.ACTIVATED.value]
        if invalid:
            for serial_number in invalid:
                self.exceptions.create(
                    exception_type=ExceptionType.SERIAL_INVALID_TRANSITION,
                    related_entity_type="PackagingSerial",
                    related_entity_id=serial_number,
                    description="Only ACTIVATED serials can enter warehouse.",
                    actor_user_id=payload.actor_user_id,
                )
            self.db.commit()
            raise DomainError(f"Only ACTIVATED serials can be warehoused. Invalid serials: {', '.join(invalid)}.")

        if not serials:
            raise DomainError("Warehouse receipt requires at least one serial.")

        allowed_locations = [item.strip() for item in settings.allowed_warehouse_locations.split(",") if item.strip()]
        if payload.warehouse_location not in allowed_locations:
            self.exceptions.create(
                exception_type=ExceptionType.MANUAL_OVERRIDE,
                related_entity_type="WarehouseReceipt",
                related_entity_id=payload.warehouse_location,
                description=f"Serials scanned into unapproved warehouse location {payload.warehouse_location}.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Warehouse location is not approved for this mill.")

        if payload.quantity is not None and payload.quantity != len(serials):
            self.exceptions.create(
                exception_type=ExceptionType.MANUAL_OVERRIDE,
                related_entity_type="WarehouseReceipt",
                related_entity_id=payload.warehouse_location,
                description=f"Warehouse receipt quantity {payload.quantity} does not match serial count {len(serials)}.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Warehouse receipt quantity does not match serial count.")

        batch_ids = {item.production_batch_id for item in serials}
        if len(batch_ids) != 1:
            raise DomainError("Warehouse receipt serials must belong to one production batch.")
        if payload.batch_id and serials[0].production_batch.batch_id != payload.batch_id:
            raise DomainError("Warehouse receipt serials do not belong to the requested batch.")

        total_weight = round(sum(item.bag_weight_kg for item in serials), 2)
        receipt = WarehouseReceipt(
            serial_range=serial_range(payload.serial_numbers),
            production_batch_id=serials[0].production_batch_id,
            sku=payload.sku,
            quantity=len(serials),
            total_weight_kg=total_weight,
            warehouse_location=payload.warehouse_location,
            stock_age_days=0,
            status="IN_STOCK",
            serial_numbers=to_csv(payload.serial_numbers),
            received_at=utcnow(),
        )
        self.repo.create(receipt)
        for serial in serials:
            old_value = {"status": serial.status}
            serial.status = SerialStatus.WAREHOUSED.value
            serial.status_updated_at = utcnow()
            serial.warehouse_location = payload.warehouse_location
            serial.warehouse_receipt = receipt
            self.audit.log(
                actor_user_id=payload.actor_user_id,
                action="WAREHOUSE_SERIAL",
                entity_type="PackagingSerial",
                entity_id=serial.serial_number,
                old_value=old_value,
                new_value={"status": serial.status, "warehouse_location": payload.warehouse_location},
                detail="Serial warehoused under receipt.",
            )

        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action="CREATE_WAREHOUSE_RECEIPT",
            entity_type="WarehouseReceipt",
            entity_id=receipt.id,
            new_value={"quantity": receipt.quantity, "serial_numbers": payload.serial_numbers},
            detail="Warehouse receipt created and serial custody updated.",
        )
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def scan_activated_not_warehoused(self) -> None:
        mill = self.mills.get_demo_mill()
        limit_hours = mill.activated_warehouse_limit_hours if mill else settings.activated_warehouse_limit_hours
        cutoff = utcnow() - timedelta(hours=limit_hours)
        for serial in self.serials.stale_activated(cutoff):
            self.exceptions.create(
                exception_type=ExceptionType.ACTIVATED_NOT_WAREHOUSED,
                related_entity_type="PackagingSerial",
                related_entity_id=serial.serial_number,
                description=f"Serial has been ACTIVATED for more than {limit_hours} hours without warehouse receipt.",
            )
