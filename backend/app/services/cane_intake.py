from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import DomainError, ExceptionType
from app.models import CaneIntake
from app.repositories.core import CaneIntakeRepository, MillRepository, SupplierRepository, UserRepository
from app.schemas import CaneIntakeCreate
from app.services.audit import AuditService
from app.services.exceptions import ExceptionService


class CaneIntakeService:
    def __init__(self, db: Session):
        self.db = db
        self.mills = MillRepository(db)
        self.suppliers = SupplierRepository(db)
        self.users = UserRepository(db)
        self.repo = CaneIntakeRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def create(self, payload: CaneIntakeCreate) -> CaneIntake:
        mill = self.mills.get_demo_mill()
        if not mill:
            raise DomainError("Demo mill is not seeded", status_code=404)

        if payload.manual_weight_override and not payload.override_reason:
            self.exceptions.create(
                exception_type=ExceptionType.MANUAL_OVERRIDE,
                related_entity_type="CaneIntake",
                related_entity_id=payload.vehicle_number,
                description="Manual weight override was attempted without a reason.",
                actor_user_id=payload.operator_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Manual weight override requires a reason.")

        if self.repo.ticket_exists(payload.cane_ticket_id):
            self.exceptions.create(
                exception_type=ExceptionType.MANUAL_OVERRIDE,
                related_entity_type="CaneIntake",
                related_entity_id=payload.cane_ticket_id or payload.vehicle_number,
                description="Cane ticket was reused for a second intake.",
                actor_user_id=payload.operator_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Cane ticket has already been used.")

        recent_window = utc_cutoff(settings.duplicate_vehicle_window_minutes)
        recent_vehicle = self.repo.recent_vehicle_entry(payload.vehicle_number, recent_window)
        if recent_vehicle:
            self.exceptions.create(
                exception_type=ExceptionType.MANUAL_OVERRIDE,
                related_entity_type="CaneIntake",
                related_entity_id=payload.vehicle_number,
                description=(
                    f"Vehicle {payload.vehicle_number} already has intake {recent_vehicle.delivery_id} "
                    f"inside the {settings.duplicate_vehicle_window_minutes}-minute duplicate window."
                ),
                actor_user_id=payload.operator_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Duplicate vehicle intake inside unrealistic short time window.")

        if payload.gross_weight_kg <= 0 or payload.tare_weight_kg <= 0:
            self.exceptions.create(
                exception_type=ExceptionType.WEIGHT_INVALID,
                related_entity_type="CaneIntake",
                related_entity_id=payload.vehicle_number,
                description="Gross and tare weights must both be positive.",
                actor_user_id=payload.operator_user_id,
            )
            self.db.commit()
            raise DomainError("Gross weight and tare weight must be positive.")

        if payload.gross_weight_kg <= payload.tare_weight_kg:
            self.exceptions.create(
                exception_type=ExceptionType.WEIGHT_INVALID,
                related_entity_type="CaneIntake",
                related_entity_id=payload.vehicle_number,
                description="Gross weight must be greater than tare weight.",
                actor_user_id=payload.operator_user_id,
            )
            self.db.commit()
            raise DomainError("Gross weight must be greater than tare weight.")

        supplier = self.suppliers.get_or_create(mill, payload.farmer_supplier_name)
        operator = self.users.get(payload.operator_user_id)
        net_weight = payload.gross_weight_kg - payload.tare_weight_kg
        item = CaneIntake(
            delivery_id=self.repo.next_delivery_id(),
            cane_ticket_id=payload.cane_ticket_id,
            mill=mill,
            farmer_supplier=supplier,
            vehicle_number=payload.vehicle_number,
            gross_weight_kg=payload.gross_weight_kg,
            tare_weight_kg=payload.tare_weight_kg,
            net_cane_weight_kg=net_weight,
            collection_point=payload.collection_point,
            operator_user_id=operator.id if operator else None,
            operator_name=operator.name if operator else payload.operator_name,
            manual_weight_override="YES" if payload.manual_weight_override else "NO",
            override_reason=payload.override_reason,
            status=payload.status.upper().replace(" ", "_"),
        )
        self.repo.create(item)
        self.audit.log(
            actor_user_id=payload.operator_user_id,
            action="CREATE_CANE_INTAKE",
            entity_type="CaneIntake",
            entity_id=item.delivery_id,
            new_value={
                "delivery_id": item.delivery_id,
                "net_cane_weight_kg": item.net_cane_weight_kg,
                "vehicle_number": item.vehicle_number,
                "supplier": supplier.name,
            },
            detail="Cane intake created with validated weighbridge values.",
        )
        self.db.commit()
        self.db.refresh(item)
        return item


def utc_cutoff(minutes: int):
    from app.utils import utcnow

    return utcnow() - timedelta(minutes=minutes)
