from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.models import User
from app.modules.workflows.models import Notification
from app.utils.email_service import send_notification_email
from ...timeutils import utc_now

# NOTE(rebuild-phase0): The old 17-stage/11-role workflow engine (STAGE_ORDER,
# TRANSITIONS, ALLOWED_BY_STAGE, ALLOWED_BY_ROLE, REQUIRED_STATUS_BY_ACTION,
# COMMENT_REQUIRED_ACTIONS, refresh_risk_status, and the Correction CRUD
# helpers that used to live here) has been removed per REBUILD_BRIEF.md
# Section 1. The new 4-role/9-status transition model is Phase 1 work and is
# intentionally not implemented here.


def create_reference(agreement_type: str, agreement_id: int) -> str:
    """Build a unique, stable reference using the persisted database ID."""
    year = utc_now().year
    normalized_type = "".join(ch for ch in agreement_type.upper() if ch.isalnum()) or "AGR"
    return f"JKUAT-{normalized_type}-{year}-{agreement_id:04d}"


def notify_user(
    db: Session,
    user: User,
    title: str,
    message: str,
    agreement_id: int | None = None,
    level: str = "info",
) -> None:
    db.add(Notification(user_id=user.id, title=title, message=message, level=level, agreement_id=agreement_id))
    send_notification_email(user.email, user.full_name, title, message)


def notify_roles(db: Session, roles: set[str], title: str, message: str, agreement_id: int | None = None, level: str = "info") -> None:
    users = db.scalars(select(User).where(User.role.in_(roles), User.is_active.is_(True))).all()
    for user in users:
        notify_user(db, user, title, message, agreement_id, level)
