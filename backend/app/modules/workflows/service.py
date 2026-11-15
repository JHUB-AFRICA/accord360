from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.users.models import User
from app.modules.workflows.models import Notification
from app.timeutils import utc_now


def create_notification(
    db: Session,
    *,
    user: User,
    title: str,
    message: str,
    event_type: str = "workflow.update",
    category: str = "status_update",
    severity: str = "info",
    actor: User | None = None,
    agreement_id: int | None = None,
    action_url: str | None = None,
    requires_action: bool = False,
    dedupe_key: str | None = None,
) -> Notification:
    """Create one owner-scoped notification, idempotently when keyed."""
    if dedupe_key:
        existing = db.scalar(select(Notification).where(Notification.dedupe_key == dedupe_key))
        if existing:
            return existing
    item = Notification(
        user_id=user.id, event_type=event_type, category=category, severity=severity,
        level=severity,
        title=title, message=message, actor_id=actor.id if actor else None,
        agreement_id=agreement_id, action_url=action_url,
        requires_action=requires_action, dedupe_key=dedupe_key,
    )
    db.add(item)
    db.flush()
    return item


def notify_user(
    db: Session, user: User, title: str, message: str, agreement_id: int | None = None,
    level: str = "info", *, event_type: str = "workflow.update", category: str = "status_update",
    severity: str | None = None, actor: User | None = None, action_url: str | None = None,
    requires_action: bool = False, dedupe_key: str | None = None,
) -> Notification:
    return create_notification(
        db, user=user, title=title, message=message, agreement_id=agreement_id,
        event_type=event_type, category=category, severity=severity or level,
        actor=actor, action_url=action_url or (f"/agreements/{agreement_id}" if agreement_id else None),
        requires_action=requires_action, dedupe_key=dedupe_key,
    )


def notify_roles(
    db: Session, roles: set[str], title: str, message: str, agreement_id: int | None = None,
    level: str = "info", *, event_type: str = "workflow.update", category: str = "status_update",
    severity: str | None = None, actor: User | None = None, action_url: str | None = None,
    requires_action: bool = False, dedupe_key: str | None = None,
) -> list[Notification]:
    users = db.scalars(select(User).where(User.role.in_(roles), User.is_active.is_(True))).all()
    return [notify_user(
        db, user, title, message, agreement_id, level, event_type=event_type, category=category,
        severity=severity, actor=actor, action_url=action_url, requires_action=requires_action,
        dedupe_key=f"{dedupe_key}:{user.id}" if dedupe_key else None,
    ) for user in users]


def resolve_notifications(
    db: Session, *, agreement_id: int, event_types: set[str] | None = None,
    roles: set[str] | None = None,
) -> int:
    """Resolve open task notifications for a completed workflow action."""
    query = select(Notification).where(
        Notification.agreement_id == agreement_id,
        Notification.requires_action.is_(True), Notification.resolved_at.is_(None),
    )
    if event_types:
        query = query.where(Notification.event_type.in_(event_types))
    if roles:
        query = query.join(User, Notification.user_id == User.id).where(User.role.in_(roles))
    rows = db.scalars(query).all()
    now = utc_now()
    for row in rows:
        row.resolved_at = now
    return len(rows)


def set_read(notification: Notification, read: bool) -> None:
    """Maintain the read_at/is_read invariant."""
    notification.is_read = read
    notification.read_at = utc_now() if read else None
