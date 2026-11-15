"""Focused task-inbox notification contract tests."""
import os
from pathlib import Path
from uuid import uuid4

TEST_DB = Path("test_notifications_contract.db")
if TEST_DB.exists(): TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "false"

from fastapi import HTTPException
from app.main import app  # noqa: F401
from app.db.session import SessionLocal
from app.modules.users.models import User
from app.modules.workflows.models import Notification
from app.modules.workflows.notifications import list_notifications, unread_count, mark_read, mark_unread, mark_all_read
from app.modules.workflows.service import create_notification


def _user(role="researcher"):
    with SessionLocal() as db:
        user = User(full_name=f"Test {uuid4().hex}", email=f"notification-{uuid4().hex}@accord360.app", password_hash="test", role=role)
        db.add(user); db.commit(); db.refresh(user)
        return user.email


def _seed(email, count=3):
    with SessionLocal() as db:
        user = db.query(User).filter_by(email=email).one()
        for i in range(count):
            db.add(Notification(user_id=user.id, event_type="agreement.submitted", category="action_required", severity="info", level="info", title=f"Task {i}", message="Review agreement", requires_action=True))
        db.commit()


def test_timeline_envelope_paginates_and_exposes_structured_fields():
    email = _user(); _seed(email, 55)
    with SessionLocal() as db:
        user = db.query(User).filter_by(email=email).one()
        first = list_notifications(limit=50, cursor=None, unread_only=False, category=None, db=db, user=user)
        assert len(first.items) == 50 and first.next_cursor
        assert first.items[0].event_type == "agreement.submitted"
        second = list_notifications(limit=20, cursor=first.next_cursor, unread_only=False, category=None, db=db, user=user)
        assert len(second.items) == 5


def test_read_unread_all_count_and_owner_scope():
    email, other = _user(), _user(); _seed(email, 2); _seed(other, 1)
    with SessionLocal() as db:
        user = db.query(User).filter_by(email=email).one(); outsider = db.query(User).filter_by(email=other).one()
        assert unread_count(db=db, user=user).count == 2
        item_id = db.query(Notification).filter_by(user_id=user.id).first().id
        marked = mark_read(item_id, db=db, user=user)
        assert marked.is_read and marked.read_at
        assert unread_count(db=db, user=user).count == 1
        assert mark_unread(item_id, db=db, user=user).read_at is None
        try: mark_read(item_id, db=db, user=outsider)
        except HTTPException as exc: assert exc.status_code == 404
        assert mark_all_read(db=db, user=user)["updated"] == 2


def test_dedupe_key_is_idempotent():
    email = _user()
    with SessionLocal() as db:
        user = db.query(User).filter_by(email=email).one()
        first = create_notification(db, user=user, title="x", message="x", dedupe_key="test-key")
        second = create_notification(db, user=user, title="x", message="x", dedupe_key="test-key")
        assert first.id == second.id
