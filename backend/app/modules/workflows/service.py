from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.models import User
from app.modules.workflows.models import Notification
from app.utils.email_service import send_notification_email
from ...timeutils import utc_now

# NOTE(rebuild-phase0/1): The old 17-stage/11-role workflow engine
# (STAGE_ORDER, TRANSITIONS, ALLOWED_BY_STAGE, ALLOWED_BY_ROLE,
# REQUIRED_STATUS_BY_ACTION, COMMENT_REQUIRED_ACTIONS, refresh_risk_status,
# create_reference, and the Correction CRUD helpers that used to live here)
# has been removed per REBUILD_BRIEF.md Section 1. The new 4-role/9-status
# transition graph lives in app.modules.agreements.service.TRANSITIONS
# (Phase 1); Agreement no longer has a reference_number field (Section 2.6).


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
