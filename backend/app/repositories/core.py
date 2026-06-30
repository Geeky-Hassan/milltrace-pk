from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.domain import ExceptionStatus, SerialStatus
from app.models import (
    AuditLog,
    BuyerReceipt,
    CaneIntake,
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
from app.utils import utcnow


class BaseRepository:
    def __init__(self, db: Session):
        self.db = db


class MillRepository(BaseRepository):
    def get_demo_mill(self) -> Mill | None:
        return self.db.query(Mill).order_by(Mill.id).first()


class UserRepository(BaseRepository):
    def get(self, user_id: int | None) -> User | None:
        if not user_id:
            return None
        return self.db.query(User).options(joinedload(User.role)).filter(User.id == user_id).first()

    def get_by_role_code(self, role_code: str) -> User | None:
        return (
            self.db.query(User)
            .join(Role)
            .options(joinedload(User.role), joinedload(User.mill))
            .filter(Role.code == role_code)
            .first()
        )

    def list(self) -> list[User]:
        return self.db.query(User).options(joinedload(User.role), joinedload(User.mill)).order_by(User.id).all()


class SupplierRepository(BaseRepository):
    def get_or_create(self, mill: Mill, name: str) -> FarmerSupplier:
        supplier = (
            self.db.query(FarmerSupplier)
            .filter(FarmerSupplier.mill_id == mill.id, FarmerSupplier.name == name)
            .first()
        )
        if supplier:
            return supplier
        supplier = FarmerSupplier(mill=mill, name=name)
        self.db.add(supplier)
        self.db.flush()
        return supplier


class CaneIntakeRepository(BaseRepository):
    def next_delivery_id(self) -> str:
        return f"CI-{utcnow().year}-{self.db.query(CaneIntake).count() + 1:04d}"

    def create(self, item: CaneIntake) -> CaneIntake:
        self.db.add(item)
        self.db.flush()
        return item

    def ticket_exists(self, cane_ticket_id: str | None) -> bool:
        if not cane_ticket_id:
            return False
        return self.db.query(CaneIntake).filter(CaneIntake.cane_ticket_id == cane_ticket_id).first() is not None

    def recent_vehicle_entry(self, vehicle_number: str, since: datetime) -> CaneIntake | None:
        return (
            self.db.query(CaneIntake)
            .filter(CaneIntake.vehicle_number == vehicle_number, CaneIntake.mill_gate_timestamp >= since)
            .order_by(CaneIntake.mill_gate_timestamp.desc())
            .first()
        )

    def get(self, item_id: int) -> CaneIntake | None:
        return (
            self.db.query(CaneIntake)
            .options(joinedload(CaneIntake.farmer_supplier), joinedload(CaneIntake.operator))
            .filter(CaneIntake.id == item_id)
            .first()
        )

    def get_many(self, item_ids: list[int]) -> list[CaneIntake]:
        return self.db.query(CaneIntake).filter(CaneIntake.id.in_(item_ids)).all()

    def list(self) -> list[CaneIntake]:
        return (
            self.db.query(CaneIntake)
            .options(joinedload(CaneIntake.farmer_supplier), joinedload(CaneIntake.operator))
            .order_by(CaneIntake.id.desc())
            .all()
        )


class ProductionBatchRepository(BaseRepository):
    def next_batch_id(self) -> str:
        return f"BATCH-{utcnow().year}-{self.db.query(ProductionBatch).count() + 1:04d}"

    def create(self, item: ProductionBatch) -> ProductionBatch:
        self.db.add(item)
        self.db.flush()
        return item

    def cane_intake_already_assigned(self, cane_intake_id: int) -> bool:
        return (
            self.db.query(ProductionBatchCaneIntake)
            .filter(ProductionBatchCaneIntake.cane_intake_id == cane_intake_id)
            .first()
            is not None
        )

    def get(self, item_id: int) -> ProductionBatch | None:
        return self.db.query(ProductionBatch).filter(ProductionBatch.id == item_id).first()

    def get_by_batch_id(self, batch_id: str) -> ProductionBatch | None:
        return self.db.query(ProductionBatch).filter(ProductionBatch.batch_id == batch_id).first()

    def list(self) -> list[ProductionBatch]:
        return self.db.query(ProductionBatch).order_by(ProductionBatch.id.desc()).all()


class SerialRepository(BaseRepository):
    def exists(self, serial_number: str) -> bool:
        return self.db.query(PackagingSerial).filter(PackagingSerial.serial_number == serial_number).first() is not None

    def get(self, item_id: int) -> PackagingSerial | None:
        return (
            self.db.query(PackagingSerial)
            .options(joinedload(PackagingSerial.production_batch))
            .filter(PackagingSerial.id == item_id)
            .first()
        )

    def get_by_number(self, serial_number: str) -> PackagingSerial | None:
        return (
            self.db.query(PackagingSerial)
            .options(joinedload(PackagingSerial.production_batch))
            .filter(PackagingSerial.serial_number == serial_number)
            .first()
        )

    def get_by_numbers(self, serial_numbers: list[str]) -> list[PackagingSerial]:
        if not serial_numbers:
            return []
        return (
            self.db.query(PackagingSerial)
            .options(joinedload(PackagingSerial.production_batch))
            .filter(PackagingSerial.serial_number.in_(serial_numbers))
            .all()
        )

    def max_sequence_for_batch(self, production_batch_id: int) -> int:
        value = (
            self.db.query(func.max(PackagingSerial.sequence_number))
            .filter(PackagingSerial.production_batch_id == production_batch_id)
            .scalar()
        )
        return int(value or 0)

    def list_for_batch(self, production_batch_id: int) -> list[PackagingSerial]:
        return (
            self.db.query(PackagingSerial)
            .filter(PackagingSerial.production_batch_id == production_batch_id)
            .order_by(PackagingSerial.sequence_number)
            .all()
        )

    def list(self) -> list[PackagingSerial]:
        return (
            self.db.query(PackagingSerial)
            .options(joinedload(PackagingSerial.production_batch))
            .order_by(PackagingSerial.id.desc())
            .all()
        )

    def create_many(self, serials: list[PackagingSerial]) -> list[PackagingSerial]:
        self.db.add_all(serials)
        self.db.flush()
        return serials

    def stale_activated(self, older_than: datetime) -> list[PackagingSerial]:
        return (
            self.db.query(PackagingSerial)
            .filter(
                PackagingSerial.status == SerialStatus.ACTIVATED.value,
                PackagingSerial.status_updated_at < older_than,
            )
            .all()
        )


class WarehouseRepository(BaseRepository):
    def create(self, item: WarehouseReceipt) -> WarehouseReceipt:
        self.db.add(item)
        self.db.flush()
        return item

    def get(self, item_id: int) -> WarehouseReceipt | None:
        return (
            self.db.query(WarehouseReceipt)
            .options(joinedload(WarehouseReceipt.production_batch))
            .filter(WarehouseReceipt.id == item_id)
            .first()
        )

    def list(self) -> list[WarehouseReceipt]:
        return (
            self.db.query(WarehouseReceipt)
            .options(joinedload(WarehouseReceipt.production_batch))
            .order_by(WarehouseReceipt.id.desc())
            .all()
        )


class DispatchRepository(BaseRepository):
    def next_dispatch_id(self) -> str:
        return f"DSP-{utcnow().year}-{self.db.query(Dispatch).count() + 1:04d}"

    def create(self, item: Dispatch) -> Dispatch:
        self.db.add(item)
        self.db.flush()
        return item

    def get(self, item_id: int) -> Dispatch | None:
        return self.db.query(Dispatch).filter(Dispatch.id == item_id).first()

    def get_by_dispatch_id(self, dispatch_id: str) -> Dispatch | None:
        return self.db.query(Dispatch).filter(Dispatch.dispatch_id == dispatch_id).first()

    def list(self) -> list[Dispatch]:
        return self.db.query(Dispatch).order_by(Dispatch.id.desc()).all()

    def pending_receipt_before(self, cutoff: datetime) -> list[Dispatch]:
        return (
            self.db.query(Dispatch)
            .outerjoin(BuyerReceipt)
            .filter(BuyerReceipt.id.is_(None), Dispatch.dispatched_at < cutoff)
            .all()
        )


class BuyerReceiptRepository(BaseRepository):
    def create(self, item: BuyerReceipt) -> BuyerReceipt:
        self.db.add(item)
        self.db.flush()
        return item

    def get(self, item_id: int) -> BuyerReceipt | None:
        return (
            self.db.query(BuyerReceipt)
            .options(joinedload(BuyerReceipt.dispatch))
            .filter(BuyerReceipt.id == item_id)
            .first()
        )

    def list(self) -> list[BuyerReceipt]:
        return (
            self.db.query(BuyerReceipt)
            .options(joinedload(BuyerReceipt.dispatch))
            .order_by(BuyerReceipt.id.desc())
            .all()
        )

    def exists_for_dispatch(self, dispatch_record_id: int) -> bool:
        return self.db.query(BuyerReceipt).filter(BuyerReceipt.dispatch_record_id == dispatch_record_id).first() is not None


class ExceptionRepository(BaseRepository):
    def create(self, item: ExceptionAlert) -> ExceptionAlert:
        self.db.add(item)
        self.db.flush()
        return item

    def open_exists(self, exception_type: str, related_entity_type: str, related_entity_id: str) -> bool:
        return (
            self.db.query(ExceptionAlert)
            .filter(
                ExceptionAlert.type == exception_type,
                ExceptionAlert.related_entity_type == related_entity_type,
                ExceptionAlert.related_entity_id == str(related_entity_id),
                ExceptionAlert.status.in_([ExceptionStatus.OPEN.value, ExceptionStatus.IN_REVIEW.value]),
            )
            .first()
            is not None
        )

    def list(self, severity: str | None = None) -> list[ExceptionAlert]:
        query = self.db.query(ExceptionAlert).order_by(ExceptionAlert.id.desc())
        if severity:
            query = query.filter(ExceptionAlert.severity == severity.upper())
        return query.all()

    def get(self, item_id: int) -> ExceptionAlert | None:
        return self.db.query(ExceptionAlert).filter(ExceptionAlert.id == item_id).first()


class AuditRepository(BaseRepository):
    def create(self, item: AuditLog) -> AuditLog:
        self.db.add(item)
        self.db.flush()
        return item

    def list(self) -> list[AuditLog]:
        return self.db.query(AuditLog).options(joinedload(AuditLog.actor)).order_by(AuditLog.id.desc()).all()

    def latest(self) -> AuditLog | None:
        return self.db.query(AuditLog).order_by(AuditLog.id.desc()).first()
