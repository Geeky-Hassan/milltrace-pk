from sqlalchemy.orm import Session

from app.domain import EXCEPTION_DEFINITIONS, ExceptionStatus, ExceptionType
from app.models import ExceptionAlert
from app.repositories.core import ExceptionRepository
from app.services.audit import AuditService
from app.utils import utcnow


class ExceptionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ExceptionRepository(db)
        self.audit = AuditService(db)

    def create(
        self,
        *,
        exception_type: ExceptionType,
        related_entity_type: str,
        related_entity_id: str | int,
        description: str,
        actor_user_id: int | None = None,
        suggested_action: str | None = None,
        severity: str | None = None,
        title: str | None = None,
        allow_duplicate: bool = False,
    ) -> ExceptionAlert:
        definition_severity, definition_title, definition_action = EXCEPTION_DEFINITIONS[exception_type]
        if not allow_duplicate and self.repo.open_exists(exception_type.value, related_entity_type, str(related_entity_id)):
            existing = [
                item
                for item in self.repo.list()
                if item.type == exception_type.value
                and item.related_entity_type == related_entity_type
                and item.related_entity_id == str(related_entity_id)
                and item.status in {ExceptionStatus.OPEN.value, ExceptionStatus.IN_REVIEW.value}
            ]
            alert = existing[0]
            alert.occurrence_count += 1
            alert.description = description
            self.audit.log(
                actor_user_id=actor_user_id,
                action="EXCEPTION_GROUPED",
                entity_type="ExceptionAlert",
                entity_id=alert.id,
                new_value={"occurrence_count": alert.occurrence_count, "type": alert.type},
                detail="Duplicate exception occurrence grouped into existing open alert.",
            )
            return alert

        alert = ExceptionAlert(
            type=exception_type.value,
            alert_type=exception_type.value,
            severity=(severity or definition_severity).upper(),
            title=title or definition_title,
            related_entity_type=related_entity_type,
            related_entity_id=str(related_entity_id),
            related_entity=f"{related_entity_type}:{related_entity_id}",
            description=description,
            suggested_action=suggested_action or definition_action,
            status=ExceptionStatus.OPEN.value,
        )
        self.repo.create(alert)
        self.audit.log(
            actor_user_id=actor_user_id,
            action="EXCEPTION_CREATED",
            entity_type="ExceptionAlert",
            entity_id=alert.type,
            new_value={
                "type": alert.type,
                "severity": alert.severity,
                "related_entity_type": related_entity_type,
                "related_entity_id": str(related_entity_id),
            },
            detail=alert.description,
        )
        return alert

    def resolve(
        self,
        alert_id: int,
        actor_user_id: int | None,
        status: ExceptionStatus = ExceptionStatus.RESOLVED,
        reason: str | None = None,
    ) -> ExceptionAlert:
        alert = self.repo.get(alert_id)
        if not alert:
            raise ValueError("Exception alert not found")
        if status in {ExceptionStatus.RESOLVED, ExceptionStatus.DISMISSED} and not reason:
            raise ValueError("Resolving or dismissing an exception requires a reason.")
        old_value = {"status": alert.status, "resolved_at": alert.resolved_at}
        alert.status = status.value
        alert.resolution_reason = reason
        if status in {ExceptionStatus.RESOLVED, ExceptionStatus.DISMISSED}:
            alert.resolved_at = utcnow()
        self.audit.log(
            actor_user_id=actor_user_id,
            action="EXCEPTION_RESOLVED" if status == ExceptionStatus.RESOLVED else f"EXCEPTION_{status.value}",
            entity_type="ExceptionAlert",
            entity_id=alert.id,
            old_value=old_value,
            new_value={"status": alert.status, "resolved_at": alert.resolved_at, "reason": reason},
            detail=f"{alert.type} marked {alert.status}.",
        )
        return alert
