"""Phase 3 comments, execution, progress, expiry and notification tests."""

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
from app.models import Agreement, AgreementVersion, Notification, Partner, User
from app.modules.agreements.expiry import run_daily_expiry_check
from app.modules.agreements.schemas import CommentCreate, CommentUpdate, ProgressUpdateCreate
from app.modules.agreements.service import (
    create_comment,
    create_progress_update,
    list_progress_updates,
    list_comments,
    transition_agreement,
    update_comment,
    upload_initial_draft,
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


def _agreement(db, researcher: User, status: str) -> Agreement:
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
    db.add(agreement)
    db.flush()
    return agreement


def _version(db, agreement: Agreement, uploader: User, is_final: bool = False) -> AgreementVersion:
    version = AgreementVersion(
        agreement_id=agreement.id,
        file=f"agreement-versions/{uuid4().hex}.docx",
        uploaded_by_id=uploader.id,
        status_at_time=agreement.status,
        is_final=is_final,
    )
    db.add(version)
    db.flush()
    return version


def test_legal_comments_are_scoped_and_status_gated():
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        legal = _user(db, "legal", f"{suffix}-legal")
        linkages = _user(db, "linkages", f"{suffix}-linkages")
        agreement = _agreement(db, researcher, "pending_legal_review")
        version = _version(db, agreement, linkages)
        db.commit()

        comment = create_comment(db, legal, version.id, CommentCreate(text="Review Clause 4.2", section_reference="Clause 4.2"), None)
        assert comment.status == "open"
        assert len(list_comments(db, legal, version.id)) == 1
        resolved = update_comment(db, legal, comment.id, CommentUpdate(status="resolved"), None)
        assert resolved.status == "resolved"

        agreement.status = "returned_for_corrections"
        db.commit()
        with pytest.raises(HTTPException) as error:
            create_comment(db, legal, version.id, CommentCreate(text="No new comment here"), None)
        assert error.value.status_code == 409


def test_status_notifications_use_the_phase3_recipient_table():
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-linkages")
        legal = _user(db, "legal", f"{suffix}-legal")

        draft = _agreement(db, researcher, "draft_generated")
        db.commit()
        upload_initial_draft(db, linkages, draft.id, b"legal draft", "draft.docx", None)
        draft_notifications = db.scalars(select(Notification).where(Notification.agreement_id == draft.id)).all()
        legal_ids = {item.id for item in db.scalars(select(User).where(User.role == "legal")).all()}
        assert {item.user_id for item in draft_notifications} == legal_ids

        changes = _agreement(db, researcher, "pending_legal_review")
        db.commit()
        transition_agreement(db, legal, changes.id, TransitionRequest(action="request_corrections"), None)
        linkages_ids = {item.id for item in db.scalars(select(User).where(User.role == "linkages")).all()}
        assert {item.user_id for item in db.scalars(select(Notification).where(Notification.agreement_id == changes.id)).all()} == linkages_ids

        approval = _agreement(db, researcher, "pending_legal_verification")
        db.commit()
        transition_agreement(db, legal, approval.id, TransitionRequest(action="approve"), None)
        assert {item.user_id for item in db.scalars(select(Notification).where(Notification.agreement_id == approval.id)).all()} == linkages_ids


def test_corrected_upload_and_final_upload_lock_and_notify():
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
        corrected = upload_initial_draft(db, linkages, agreement_id, b"corrected", "corrected.docx", None)
        assert corrected.status == "pending_legal_verification"

    # Separate sessions mirror the application request lifecycle and ensure
    # the version history is reloaded after the corrected upload.
    with SessionLocal() as db:
        agreement = db.get(Agreement, agreement_id)
        linkages = db.get(User, linkages_id)
        agreement.status = "awaiting_signatures"
        db.commit()
        final = upload_initial_draft(db, linkages, agreement_id, b"signed", "signed.docx", None)
        assert final.status == "fully_executed"
        assert final.versions[-1].is_final is True
        assert final.expiry_alert_date == agreement.end_date - relativedelta(months=6)
        recipients = {
            notification.user_id
            for notification in db.scalars(select(Notification).where(Notification.agreement_id == agreement_id)).all()
        }
        assert {researcher_id, legal_id, me_id}.issubset(recipients)

        with pytest.raises(HTTPException) as error:
            upload_initial_draft(db, linkages, agreement_id, b"another", "another.docx", None)
        assert error.value.status_code == 409


def test_generic_transition_cannot_bypass_the_required_file_upload():
    """Section 4.2/4.3: resubmit_for_verification and mark_fully_executed
    must only ever happen as a side effect of upload_initial_draft actually
    storing a new AgreementVersion. Both are kept in TRANSITIONS so
    available_actions() can still surface them to the frontend, but calling
    them through the generic transition endpoint must not be able to move
    status forward without a real corrected/signed document ever existing.
    """
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-linkages")

        corrections = _agreement(db, researcher, "returned_for_corrections")
        db.commit()
        with pytest.raises(HTTPException) as error:
            transition_agreement(db, linkages, corrections.id, TransitionRequest(action="resubmit_for_verification"), None)
        assert error.value.status_code == 409
        db.refresh(corrections)
        assert corrections.status == "returned_for_corrections"
        assert len(db.scalars(select(AgreementVersion).where(AgreementVersion.agreement_id == corrections.id)).all()) == 0

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
