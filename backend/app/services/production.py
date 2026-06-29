from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import DomainError, ExceptionType
from app.models import ProductionBatch, ProductionBatchCaneIntake
from app.repositories.core import CaneIntakeRepository, MillRepository, ProductionBatchRepository
from app.schemas import ProductionBatchCreate
from app.services.audit import AuditService
from app.services.exceptions import ExceptionService


class ProductionService:
    def __init__(self, db: Session):
        self.db = db
        self.mills = MillRepository(db)
        self.cane_intakes = CaneIntakeRepository(db)
        self.repo = ProductionBatchRepository(db)
        self.audit = AuditService(db)
        self.exceptions = ExceptionService(db)

    def create(self, payload: ProductionBatchCreate) -> ProductionBatch:
        mill = self.mills.get_demo_mill()
        if not mill:
            raise DomainError("Demo mill is not seeded", status_code=404)

        if not payload.cane_intake_ids:
            raise DomainError("Production batch must link at least one cane intake record.")

        selected_intakes = self.cane_intakes.get_many(payload.cane_intake_ids)
        if payload.cane_intake_ids and len(selected_intakes) != len(set(payload.cane_intake_ids)):
            raise DomainError("One or more cane intake records were not found.", status_code=404)

        already_assigned = [
            intake_id for intake_id in payload.cane_intake_ids if self.repo.cane_intake_already_assigned(intake_id)
        ]
        if already_assigned:
            raise DomainError(f"Cane intake already assigned to a production batch: {already_assigned}.")

        total_cane_input = sum(item.net_cane_weight_kg for item in selected_intakes)
        if total_cane_input <= 0:
            raise DomainError("Production batch selected cane intakes have no positive net cane weight.")

        expected_recovery = payload.expected_recovery_percentage or mill.expected_recovery_percentage or settings.default_expected_recovery_percentage
        expected_output = total_cane_input * expected_recovery / 100
        actual_output = payload.actual_sugar_output_kg
        recovery_percentage = round(actual_output / total_cane_input * 100, 2)
        if recovery_percentage > settings.max_reasonable_recovery_percentage:
            self.exceptions.create(
                exception_type=ExceptionType.RECOVERY_VARIANCE_CRITICAL,
                related_entity_type="ProductionBatch",
                related_entity_id="NEW_BATCH",
                description=f"Recovery {recovery_percentage:.2f}% exceeds physical threshold {settings.max_reasonable_recovery_percentage:.2f}%.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Actual output exceeds physically reasonable recovery threshold.")

        if recovery_percentage < settings.min_reasonable_recovery_percentage and not payload.downtime_explanation:
            self.exceptions.create(
                exception_type=ExceptionType.RECOVERY_VARIANCE_CRITICAL,
                related_entity_type="ProductionBatch",
                related_entity_id="NEW_BATCH",
                description=f"Recovery {recovery_percentage:.2f}% is abnormally low and requires downtime explanation.",
                actor_user_id=payload.actor_user_id,
                allow_duplicate=True,
            )
            self.db.commit()
            raise DomainError("Abnormally low recovery requires downtime explanation.")

        variance_kg = actual_output - expected_output
        variance_percentage = (variance_kg / expected_output * 100) if expected_output else 0
        variance_status = self._variance_status(variance_percentage)

        batch = ProductionBatch(
            batch_id=self.repo.next_batch_id(),
            mill=mill,
            shift=payload.shift,
            cane_input_weight_kg=round(total_cane_input, 2),
            expected_sugar_output_kg=round(expected_output, 2),
            actual_sugar_output_kg=actual_output,
            recovery_percentage=recovery_percentage,
            expected_recovery_percentage=expected_recovery,
            variance_kg=round(variance_kg, 2),
            variance_percentage=round(variance_percentage, 2),
            variance_status=variance_status,
            downtime_explanation=payload.downtime_explanation,
        )
        self.repo.create(batch)
        for intake in selected_intakes:
            self.db.add(ProductionBatchCaneIntake(production_batch=batch, cane_intake=intake))

        self.audit.log(
            actor_user_id=payload.actor_user_id,
            action="CREATE_PRODUCTION_BATCH",
            entity_type="ProductionBatch",
            entity_id=batch.batch_id,
            new_value={
                "batch_id": batch.batch_id,
                "cane_intake_ids": payload.cane_intake_ids,
                "cane_input_weight_kg": batch.cane_input_weight_kg,
                "actual_sugar_output_kg": batch.actual_sugar_output_kg,
                "recovery_percentage": batch.recovery_percentage,
                "variance_status": batch.variance_status,
            },
            detail="Production batch mass balance calculated.",
        )

        if variance_status in {"WARNING", "CRITICAL"}:
            exception_type = (
                ExceptionType.RECOVERY_VARIANCE_CRITICAL
                if variance_status == "CRITICAL"
                else ExceptionType.RECOVERY_VARIANCE_WARNING
            )
            self.exceptions.create(
                exception_type=exception_type,
                related_entity_type="ProductionBatch",
                related_entity_id=batch.batch_id,
                description=(
                    f"Actual sugar output variance is {batch.variance_percentage:+.2f}% "
                    f"({batch.variance_kg:+,.0f} kg) against expected recovery {expected_recovery:.2f}%."
                ),
                actor_user_id=payload.actor_user_id,
            )

        self.db.commit()
        self.db.refresh(batch)
        return batch

    @staticmethod
    def _variance_status(variance_percentage: float) -> str:
        absolute = abs(variance_percentage)
        if absolute <= 3:
            return "NORMAL"
        if absolute <= 7:
            return "WARNING"
        return "CRITICAL"
