"""Phase 2 template activation + Google Docs drafting hand-off tests.

GOOGLE_DOCS_DRAFTING_BRIEF.md Phase D retired the docx-template-merge
engine entirely: a Template is now just a pointer to a Google Doc
(master_doc_id), and create_agreement copies it via the (mocked, in tests)
Drive integration. The Researcher/Linkages hand-off is the explicit `submit`
transition, not a file upload.
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

TEST_DB = Path("test_phase2_document_engine.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_phase2_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app  # noqa: F401
from app.models import Agreement, AgreementDrivePermission, FieldDefinition, Partner, User
from app.modules.agreements.service import create_agreement, transition_agreement
from app.modules.agreements.schemas import AgreementCreate
from app.modules.templates import service as template_service
from app.modules.templates.schemas import TemplateCreate
from app.modules.workflows.schemas import TransitionRequest


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


def _definitions(db) -> None:
    for name, required in [
        ("partner_name", True),
        ("agreement_title", True),
        ("department", True),
        ("start_date", True),
        ("end_date", True),
        ("researcher_name", True),
    ]:
        if not db.scalar(select(FieldDefinition).where(FieldDefinition.field_name == name)):
            db.add(FieldDefinition(field_name=name, label=name.replace("_", " ").title(), required=required))
    db.flush()


def _mock_drive(monkeypatch):
    """Fake the Drive integration — Phase B acceptance criteria require no
    test to depend on real Google credentials.
    """
    from app.modules.agreements import service as agreement_service

    counter = {"n": 0}

    def fake_copy_template(master_doc_id, name):
        counter["n"] += 1
        return f"copy-{counter['n']}"

    def fake_grant_permission(doc_id, email, role="writer", notify=True, message=None):
        counter["n"] += 1
        return f"perm-{counter['n']}"

    def fake_revoke_permission(doc_id, permission_id):
        return None

    def fake_doc_url(doc_id):
        return f"https://docs.google.com/document/d/{doc_id}/edit"

    monkeypatch.setattr(agreement_service.google_drive, "copy_template", fake_copy_template)
    monkeypatch.setattr(agreement_service.google_drive, "grant_permission", fake_grant_permission)
    monkeypatch.setattr(agreement_service.google_drive, "revoke_permission", fake_revoke_permission)
    monkeypatch.setattr(agreement_service.google_drive, "doc_url", fake_doc_url)


def test_template_cannot_be_activated_without_a_linked_google_doc():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        linkages = _user(db, "linkages", suffix)
        template = template_service.create_template(
            db,
            TemplateCreate(document_type="MoU", master_doc_id=f"master-{suffix}"),
            linkages,
            request=None,
        )
        # Simulate a legacy row created before master_doc_id was required.
        template.master_doc_id = None
        db.commit()

        with pytest.raises(ValueError, match="linked to a Google Doc"):
            template_service.activate_template(db, template.id, linkages, request=None)
        db.refresh(template)
        assert template.is_active is False


def test_researcher_submission_copies_template_and_submit_routes_to_linkages_and_legal(monkeypatch):
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        _mock_drive(monkeypatch)
        _definitions(db)
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-l")
        legal = _user(db, "legal", f"{suffix}-g")
        partner = Partner(
            name=f"Partner {suffix}",
            sector="Research",
            country="Kenya",
            contact_email=f"partner-{suffix}@example.org",
        )
        db.add(partner)
        db.flush()
        template = template_service.create_template(
            db,
            TemplateCreate(document_type="MoU", master_doc_id="master-doc-fixture"),
            linkages,
            request=None,
        )
        template_service.activate_template(db, template.id, linkages, request=None)
        db.commit()

        field_values = {
            "partner_name": partner.name,
            "agreement_title": "Research collaboration",
            "department": "Computing",
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=365)).isoformat(),
            "researcher_name": researcher.full_name,
        }
        agreement = create_agreement(
            db,
            researcher,
            AgreementCreate(
                title="Research collaboration",
                department="Computing",
                partner_id=partner.id,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=365),
                field_values=field_values,
            ),
            request=None,
        )
        agreement_id = agreement.id
        assert agreement.status == "draft_generated"
        # Drafting-stage content lives only in the Google Doc — no
        # AgreementVersion is created at this step.
        assert agreement.versions == []
        assert agreement.template_copy_url == "https://docs.google.com/document/d/copy-1/edit"

        grants = db.scalars(
            select(AgreementDrivePermission).where(AgreementDrivePermission.agreement_id == agreement_id)
        ).all()
        assert {(g.role, g.email) for g in grants} == {
            ("researcher", researcher.email),
            ("partner", partner.contact_email),
        }
        linkages_id, legal_id, researcher_id = linkages.id, legal.id, researcher.id

    with SessionLocal() as db:
        researcher = db.get(User, researcher_id)
        updated = transition_agreement(db, researcher, agreement_id, TransitionRequest(action="submit"), None)
        assert updated.status == "linkages_review"

        grants = db.scalars(
            select(AgreementDrivePermission).where(AgreementDrivePermission.agreement_id == agreement_id)
        ).all()
        partner_grant = next(g for g in grants if g.role == "partner")
        assert partner_grant.revoked_at is not None
        # Legal gets access only once Linkages sends the agreement to Legal.
        assert {g.role for g in grants if g.revoked_at is None} == {"researcher", "linkages"}

    with SessionLocal() as db:
        linkages = db.get(User, linkages_id)
        other_draft = Agreement(
            title="Second collaboration",
            department="Computing",
            partner_id=db.scalar(select(Partner.id).limit(1)),
            researcher_id=researcher_id,
            status="draft_generated",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            template_copy_doc_id="copy-other",
            template_copy_url="https://docs.google.com/document/d/copy-other/edit",
        )
        db.add(other_draft)
        db.commit()
        with pytest.raises(HTTPException) as error:
            transition_agreement(db, linkages, other_draft.id, TransitionRequest(action="submit"), None)
        assert error.value.status_code == 403
