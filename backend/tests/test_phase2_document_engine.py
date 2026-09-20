"""Phase 2 document-generation and Researcher/Linkages hand-off tests."""

from __future__ import annotations

import io
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
from docx import Document
from fastapi import HTTPException

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app  # noqa: F401
from app.models import Agreement, FieldDefinition, Partner, Template, User
from app.modules.agreements.service import create_agreement, upload_initial_draft
from app.modules.agreements.schemas import AgreementCreate
from app.modules.templates import service as template_service
from app.modules.templates.schemas import TemplateCreate


def _docx(text: str) -> bytes:
    document = Document()
    document.add_paragraph(text)
    output = io.BytesIO()
    document.save(output)
    return output.getvalue()


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
    from sqlalchemy import select

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


def test_template_validation_reports_present_missing_and_unknown_tokens():
    with SessionLocal() as db:
        _definitions(db)
        summary = template_service.validate_docx_placeholders(
            db,
            _docx("{{partner_name}} {{agreement_title}} {{unknown_token}}"),
        )
        assert summary == {
            "present": ["agreement_title", "partner_name"],
            "missing_required": ["department", "end_date", "researcher_name", "start_date"],
            "unknown_tokens": ["unknown_token"],
            "validated": False,
        }


def test_template_missing_required_placeholder_cannot_be_activated():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        _definitions(db)
        linkages = _user(db, "linkages", suffix)
        template = template_service.create_template(
            db,
            TemplateCreate(document_type="Standard MoU"),
            linkages,
            request=None,
            content=_docx("{{partner_name}}"),
            original_name="incomplete.docx",
        )
        with pytest.raises(ValueError, match="missing required"):
            template_service.activate_template(db, template.id, linkages, request=None)
        db.refresh(template)
        assert template.is_active is False


def test_researcher_submission_generates_intake_and_linkages_upload_routes_to_legal():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        _definitions(db)
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", f"{suffix}-l")
        legal = _user(db, "legal", f"{suffix}-g")
        partner = Partner(name=f"Partner {suffix}", sector="Research", country="Kenya")
        db.add(partner)
        db.flush()
        template = template_service.create_template(
            db,
            TemplateCreate(document_type="Standard MoU"),
            linkages,
            request=None,
            content=_docx("{{partner_name}} {{agreement_title}} {{department}} {{start_date}} {{end_date}} {{researcher_name}}"),
            original_name="template.docx",
        )
        template_service.activate_template(db, template.id, linkages, request=None)
        db.commit()

        agreement = create_agreement(
            db,
            researcher,
            AgreementCreate(
                title="Research collaboration",
                department="Computing",
                partner_id=partner.id,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=365),
                field_values={},
            ),
            request=None,
        )
        agreement_id = agreement.id
        assert agreement.status == "draft_generated"
        assert len(agreement.versions) == 1
        assert agreement.versions[0].file.startswith("generated-intake/")
        generated_path = Path(os.environ["UPLOAD_DIR"]) / agreement.versions[0].file
        assert generated_path.is_file()
        assert "Research collaboration" in "\n".join(paragraph.text for paragraph in Document(generated_path).paragraphs)
        linkages_id, legal_id = linkages.id, legal.id

    # Each block below uses its own fresh session, mirroring how a real
    # deployment gets a brand-new session per HTTP request (app.db.session
    # get_db()). This avoids relying on SQLAlchemy's same-session identity
    # map / already-loaded-collection semantics, which do NOT reflect how
    # separate requests actually behave.
    with SessionLocal() as db:
        linkages = db.get(User, linkages_id)
        updated = upload_initial_draft(db, linkages, agreement_id, _docx("Legal draft"), "legal-draft.docx", None)
        assert updated.status == "pending_legal_review"
        assert len(updated.versions) == 2
        assert updated.versions[-1].uploaded_by.id == linkages_id

    with SessionLocal() as db:
        legal = db.get(User, legal_id)
        with pytest.raises(HTTPException) as error:
            upload_initial_draft(db, legal, agreement_id, _docx("Not allowed"), "not-allowed.docx", None)
        assert error.value.status_code == 403
