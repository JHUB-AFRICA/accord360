"""Phase 1 data-model invariant tests — REBUILD_BRIEF.md Section 2 Acceptance
Criteria:

- A unit test proves: activating a Template deactivates any sibling active
  Template of the same document_type in one transaction.
- A unit test proves: only one AgreementVersion per Agreement can have
  is_final=true, and no further AgreementVersion can be created after one
  exists with is_final=true for that agreement.
"""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

TEST_DB = Path("test_phase1_invariants.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from docx import Document

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app  # noqa: F401 - ensures tables are created (Base.metadata.create_all in test env)
from app.models import Agreement, AgreementVersion, Partner, Template, User
from app.modules.agreements.service import add_agreement_version
from app.modules.templates import service as template_service
from app.modules.templates.schemas import TemplateCreate


def _make_user(db, role: str, suffix: str) -> User:
    user = User(
        full_name=f"{role.title()} {suffix}",
        email=f"{role}-{suffix}@accord360.app",
        password_hash=hash_password("Password@123"),
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def _make_agreement(db, researcher: User, partner: Partner, status: str = "awaiting_signatures") -> Agreement:
    from datetime import date, timedelta

    agreement = Agreement(
        title=f"Invariant test agreement {uuid4().hex[:8]}",
        partner_id=partner.id,
        department="Computing",
        researcher_id=researcher.id,
        status=status,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
    )
    db.add(agreement)
    db.flush()
    return agreement


def _template_bytes(text: str) -> bytes:
    import io

    document = Document()
    document.add_paragraph(text)
    output = io.BytesIO()
    document.save(output)
    return output.getvalue()


def test_activating_template_deactivates_sibling_of_same_document_type():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        linkages = _make_user(db, "linkages", suffix)
        db.commit()

        first = template_service.create_template(
            db, TemplateCreate(document_type="Standard MoU"), linkages, request=None,
            content=_template_bytes("Plain template"), original_name="first.docx",
        )
        second = template_service.create_template(
            db, TemplateCreate(document_type="Standard MoU"), linkages, request=None,
            content=_template_bytes("Plain template"), original_name="second.docx",
        )
        assert first.is_active is False
        assert second.is_active is False

        template_service.activate_template(db, first.id, linkages, request=None)
        db.refresh(first)
        db.refresh(second)
        assert first.is_active is True
        assert second.is_active is False

        # Activating the sibling must atomically flip the first one off.
        template_service.activate_template(db, second.id, linkages, request=None)
        db.refresh(first)
        db.refresh(second)
        assert second.is_active is True
        assert first.is_active is False

        # At most one active Template per document_type, ever.
        active_count = (
            db.query(Template)
            .filter(Template.document_type == "Standard MoU", Template.is_active.is_(True))
            .count()
        )
        assert active_count == 1


def test_agreement_version_is_final_exclusivity_and_lock():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        researcher = _make_user(db, "researcher", suffix)
        linkages = _make_user(db, "linkages", f"{suffix}-l")
        partner = Partner(name=f"Invariant Partner {suffix}", sector="Technology", country="Kenya")
        db.add(partner)
        db.flush()
        agreement = _make_agreement(db, researcher, partner, status="awaiting_signatures")
        db.commit()

        add_agreement_version(db, agreement, file="drafts/v1.docx", uploaded_by=linkages, is_final=False)
        final_version = add_agreement_version(db, agreement, file="signed/final.pdf", uploaded_by=linkages, is_final=True)
        db.commit()
        assert final_version.is_final is True

        only_one_final = (
            db.query(AgreementVersion)
            .filter(AgreementVersion.agreement_id == agreement.id, AgreementVersion.is_final.is_(True))
            .count()
        )
        assert only_one_final == 1

        # No further AgreementVersion can be created once a final one exists.
        with pytest.raises(ValueError):
            add_agreement_version(db, agreement, file="drafts/should-fail.docx", uploaded_by=linkages, is_final=False)
