import hashlib
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog
from app.repositories.core import AuditRepository, UserRepository
from app.utils import dump_value, utcnow


class AuditService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_repo = AuditRepository(db)
        self.user_repo = UserRepository(db)

    def log(
        self,
        *,
        actor_user_id: int | None,
        action: str,
        entity_type: str,
        entity_id: str | int,
        old_value: Any = None,
        new_value: Any = None,
        detail: str = "",
    ) -> AuditLog:
        actor = self.user_repo.get(actor_user_id)
        previous = self.audit_repo.latest()
        previous_hash = previous.event_hash if previous else None
        created_at = utcnow()
        old_serialized = dump_value(old_value) if old_value is not None else None
        new_serialized = dump_value(new_value) if new_value is not None else None
        log = AuditLog(
            actor_user_id=actor.id if actor else None,
            actor_role=actor.role.code if actor and actor.role else None,
            action=action,
            entity_type=entity_type,
            entity=entity_type,
            entity_id=str(entity_id),
            old_value=old_serialized,
            new_value=new_serialized,
            detail=detail,
            previous_event_hash=previous_hash,
            created_at=created_at,
        )
        log.event_hash = self._hash_event(log)
        return self.audit_repo.create(log)

    @staticmethod
    def _hash_event(log: AuditLog) -> str:
        # This creates a tamper-evident local hash chain. A future production release
        # can periodically anchor the latest event_hash to an external blockchain.
        payload = "|".join(
            [
                log.previous_event_hash or "",
                str(log.actor_user_id or ""),
                log.actor_role or "",
                log.action,
                log.entity_type,
                log.entity_id,
                log.old_value or "",
                log.new_value or "",
                log.detail,
                log.created_at.isoformat(),
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
