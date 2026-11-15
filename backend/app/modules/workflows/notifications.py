from __future__ import annotations

import base64
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import get_current_user
from ...modules.users.models import User
from .models import Notification
from .schemas import NotificationOut, NotificationTimeline, UnreadCount
from .service import set_read

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _encode_cursor(item: Notification) -> str:
    raw = f"{item.created_at.isoformat()}|{item.id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(value: str) -> tuple[datetime, int]:
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode()
        timestamp, item_id = raw.rsplit("|", 1)
        return datetime.fromisoformat(timestamp), int(item_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid notification cursor")


@router.get("", response_model=NotificationTimeline)
def list_notifications(
    limit: int = Query(20, ge=1, le=50), cursor: str | None = None,
    unread_only: bool = False, category: str | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    conditions = [Notification.user_id == user.id]
    if unread_only:
        conditions.append(Notification.is_read.is_(False))
    if category:
        conditions.append(Notification.category == category)
    if cursor:
        created_at, item_id = _decode_cursor(cursor)
        conditions.append(or_(Notification.created_at < created_at, and_(Notification.created_at == created_at, Notification.id < item_id)))
    rows = db.scalars(select(Notification).where(*conditions).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1)).all()
    next_cursor = _encode_cursor(rows[limit - 1]) if len(rows) > limit else None
    return NotificationTimeline(items=rows[:limit], next_cursor=next_cursor)


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))) or 0
    return UnreadCount(count=count)


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))).all()
    for item in rows:
        set_read(item, True)
    db.commit()
    return {"updated": len(rows)}


def _owned(notification_id: int, db: Session, user: User) -> Notification:
    item = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    return item


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = _owned(notification_id, db, user)
    set_read(item, True)
    db.commit(); db.refresh(item)
    return item


@router.post("/{notification_id}/unread", response_model=NotificationOut)
def mark_unread(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = _owned(notification_id, db, user)
    set_read(item, False)
    db.commit(); db.refresh(item)
    return item
