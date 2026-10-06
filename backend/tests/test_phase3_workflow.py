"""Phase 3 execution, progress, expiry and notification tests.

Legal's comments live natively in the Google Doc as of
GOOGLE_DOCS_DRAFTING_BRIEF.md — there is no in-app Comment model/CRUD left
to test here (see that brief's Phase D).
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4
from dateutil.relativedelta import relativedelta

TEST_DB = Path("test_phase3_workflow.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_phase3_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import SessionLocal
from app.main import app  # noqa: F401
from app.models import Agreement, Notification, Partner, User
from app.modules.agreements.expiry import run_daily_expiry_check
from app.modules.agreements.schemas import ProgressUpdateCreate
from app.modules.agreements.service import (
    create_progress_update,
    list_progress_updates,
    transition_agreement,
    upload_final_signed_document,
)
from app.modules.workflows.schemas import TransitionRequest
from app.core.security import hash_password


def _user(db, role: str, suffix: str) -> User:
    user = User(
        full_name=f"{role.title()} {suffix}",
        email=f"{role}-{suffix}@accord360.app",
        password_hash=hash_password("Password@123"),
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def _agreement(db, researcher: User, status: str, *, with_drive_copy: bool = False) -> Agreement:
    partner = Partner(name=f"Partner {uuid4().hex[:8]}", sector="Research", country="Kenya")
    db.add(partner)
    db.flush()
    agreement = Agreement(
        title=f"Agreement {uuid4().hex[:8]}",
        department="Computing",
        partner_id=partner.id,
        researcher_id=researcher.id,
        status=status,
        start_date=date.today() - timedelta(days=30),
        end_date=date.today() + timedelta(days=365),
    )
    if with_drive_copy:
        agreement.template_copy_doc_id = f"copy-{uuid4().hex[:8]}"
        agreement.template_copy_url = f"https://docs.google.com/document/d/{agreement.template_copy_doc_id}/edit"
    db.add(agreement)
    db.flush()
    return agreement


def _mock_drive(monkeypatch):
    """No test may depend on real Google credentials — GOOGLE_DOCS_DRAFTING_BRIEF.md
    Phase B acceptance criteria.
    """
    from app.modules.agreements import service as agreement_service

    counter = {"n": 0}

    def fake_grant_permission(doc_id, email, role="writer", notify=True):
        counter["n"] += 1
        return f"perm-{counter['n']}"

    def fake_revoke_permission(doc_id, permission_id):
        return None

    monkeypatch.setattr(agreement_service.google_drive, "grant_permission", fake_grant_permission)
    monkeypatch.setattr(agreement_service.google_drive, "revoke_permission", fake_revoke_permission)


def test_status_notifications_use_the_phase3_recipient_table(monkeypatch):
    with SessionLocal() as db:
        _mock_drive(monkeypatch)
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-linkages")
        legal = _user(db, "legal", f"{suffix}-legal")

        draft = _agreement(db, researcher, "draft_generated", with_drive_copy=True)
        db.commit()
        transition_agreement(db, researcher, draft.id, TransitionRequest(action="submit"), None)
        draft_notifications = db.scalars(select(Notification).where(Notification.agreement_id == draft.id)).all()
        expected_ids = {item.id for item in db.scalars(select(User).where(User.role.in_(["linkages", "legal"]))).all()}
        assert {item.user_id for item in draft_notifications} == expected_ids

        changes = _agreement(db, researcher, "pending_legal_review")
        db.commit()
        transition_agreement(db, legal, changes.id, TransitionRequest(action="request_corrections"), None)
        linkages_ids = {item.id for item in db.scalars(select(User).where(User.role == "linkages")).all()}
        assert {item.user_id for item in db.scalars(select(Notification).where(Notification.agreement_id == changes.id)).all()} == linkages_ids

        approval = _agreement(db, researcher, "pending_legal_verification")
        db.commit()
        transition_agreement(db, legal, approval.id, TransitionRequest(action="approve"), None)
        assert {item.user_id for item in db.scalars(select(Notification).where(Notification.agreement_id == approval.id)).all()} == linkages_ids


def test_corrections_are_a_plain_transition_and_final_upload_locks_and_notifies():
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-linkages")
        legal = _user(db, "legal", f"{suffix}-legal")
        me = _user(db, "me", f"{suffix}-me")
        agreement = _agreement(db, researcher, "returned_for_corrections")
        db.commit()

        agreement_id = agreement.id
        researcher_id, linkages_id, legal_id, me_id = researcher.id, linkages.id, legal.id, me.id
        # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5.4: corrections happen
        # directly in the live Google Doc — resubmitting for verification is
        # a plain status transition, no file upload.
        corrected = transition_agreement(db, linkages, agreement_id, TransitionRequest(action="resubmit_for_verification"), None)
        assert corrected.status == "pending_legal_verification"
        assert corrected.versions == []

    # Separate sessions mirror the application request lifecycle and ensure
    # the version history is reloaded after the corrected transition.
    with SessionLocal() as db:
        agreement = db.get(Agreement, agreement_id)
        linkages = db.get(User, linkages_id)
        agreement.status = "awaiting_signatures"
        db.commit()
        final = upload_final_signed_document(db, linkages, agreement_id, b"signed", "signed.pdf", None)
        assert final.status == "fully_executed"
        assert final.versions[-1].is_final is True
        assert final.expiry_alert_date == agreement.end_date - relativedelta(months=6)
        recipients = {
            notification.user_id
            for notification in db.scalars(select(Notification).where(Notification.agreement_id == agreement_id)).all()
        }
        assert {researcher_id, legal_id, me_id}.issubset(recipients)

        with pytest.raises(HTTPException) as error:
            upload_final_signed_document(db, linkages, agreement_id, b"another", "another.pdf", None)
        assert error.value.status_code == 409


def test_generic_transition_cannot_bypass_the_required_final_upload():
    """GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5.5: mark_fully_executed must
    only ever happen as a side effect of upload_final_signed_document
    actually storing the signed scan. It stays in TRANSITIONS so
    available_actions() can still surface it to the frontend, but calling it
    through the generic transition endpoint must not be able to move status
    forward without a real signed document ever existing.
    """
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-linkages")

        signing = _agreement(db, researcher, "awaiting_signatures")
        db.commit()
        with pytest.raises(HTTPException) as error:
            transition_agreement(db, linkages, signing.id, TransitionRequest(action="mark_fully_executed"), None)
        assert error.value.status_code == 409
        db.refresh(signing)
        assert signing.status == "awaiting_signatures"


def test_progress_updates_are_researcher_owned_and_status_gated():
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        me = _user(db, "me", f"{suffix}-me")
        agreement = _agreement(db, researcher, "pending_legal_review")
        db.commit()

        with pytest.raises(HTTPException) as error:
            create_progress_update(db, researcher, agreement.id, ProgressUpdateCreate(quarter="2026-Q1", notes="Not active"), None)
        assert error.value.status_code == 400

        agreement.status = "fully_executed"
        db.commit()
        update = create_progress_update(db, researcher, agreement.id, ProgressUpdateCreate(quarter="2026-Q1", notes="Progress recorded"), None)
        assert update.submitted_by_id == researcher.id
        assert len(list_progress_updates(db, me)) == 1


def test_expiry_check_notifies_once_and_expires_stored_dates():
    run_date = date.today()
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        me = _user(db, "me", f"{suffix}-me")
        agreement = _agreement(db, researcher, "fully_executed")
        agreement.expiry_alert_date = run_date
        agreement.end_date = run_date - timedelta(days=1)
        db.commit()

        result = run_daily_expiry_check(db, today=run_date)
        assert result == {"ran": True, "approaching": 1, "expired": 1}
        assert db.get(Agreement, agreement.id).status == "expired"
        assert db.scalar(select(Notification).where(Notification.agreement_id == agreement.id, Notification.user_id == me.id))
        assert run_daily_expiry_check(db, today=run_date)["ran"] is False
