"""Template domain service — GOOGLE_DOCS_DRAFTING_BRIEF.md Phase D.

A Template no longer merges structured data into an uploaded .docx (that
docx-template-merge design was retired — see the brief's revision note). A
Template is now just a pointer to a Google Doc master (`master_doc_id`) that
create_agreement copies via the Drive API; the optional `file` upload here
is Linkages' own reference copy, never parsed or rendered by Accord 360.
"""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.deps import audit
from app.timeutils import utc_now

from .models import FieldDefinition, Template
from .schemas import TemplateCreate

MAX_TEMPLATE_BYTES = 25 * 1024 * 1024


def list_field_definitions(db: Session) -> list[FieldDefinition]:
    return db.scalars(select(FieldDefinition).order_by(FieldDefinition.id)).all()


def list_templates(db: Session, document_type: str | None = None) -> list[Template]:
    statement = select(Template).order_by(Template.document_type, Template.timestamp.desc())
    if document_type:
        statement = statement.where(Template.document_type == document_type)
    return db.scalars(statement).all()


def get_template(db: Session, template_id: int) -> Template | None:
    return db.get(Template, template_id)


def create_template(
    db: Session,
    payload: TemplateCreate,
    actor,
    request,
    content: bytes | None = None,
    original_name: str | None = None,
) -> Template:
    stored_name = None
    if content:
        if len(content) > MAX_TEMPLATE_BYTES:
            raise ValueError("Template files must be 25 MB or smaller")
        suffix = Path(original_name or "template").suffix
        stored_name = f"templates/{uuid4().hex}{suffix}"
        target = settings.upload_path / stored_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    # New templates always start inactive; activation is a separate,
    # explicit call so the exclusivity invariant below is only enforced there.
    template = Template(
        document_type=payload.document_type,
        file=stored_name,
        master_doc_id=payload.master_doc_id,
        is_active=False,
        uploaded_by_id=actor.id,
        timestamp=utc_now(),
    )
    db.add(template)
    db.flush()
    audit(db, actor, "create_template", "template", template.id, request, new_value=template.document_type)
    db.commit()
    db.refresh(template)
    return template


def activate_template(db: Session, template_id: int, actor, request) -> Template:
    """Activate a Template, atomically deactivating any sibling active
    Template of the same document_type in the same transaction.

    INVARIANT (REBUILD_BRIEF.md Section 2.6): at most one Template per
    document_type has is_active=true. GOOGLE_DOCS_DRAFTING_BRIEF.md Phase D:
    a Template without a linked Google Doc can never be activated — that's
    what create_agreement actually copies.
    """
    template = db.get(Template, template_id)
    if not template:
        raise LookupError("Template not found")
    if not template.master_doc_id:
        raise ValueError("Template must be linked to a Google Doc before it can be activated")

    db.execute(
        update(Template)
        .where(
            Template.document_type == template.document_type,
            Template.id != template.id,
            Template.is_active.is_(True),
        )
        .values(is_active=False)
    )
    template.is_active = True
    db.flush()
    audit(db, actor, "activate_template", "template", template.id, request, new_value=template.document_type)
    db.commit()
    db.refresh(template)
    return template


def deactivate_template(db: Session, template_id: int, actor, request) -> Template:
    template = db.get(Template, template_id)
    if not template:
        raise LookupError("Template not found")
    template.is_active = False
    db.flush()
    audit(db, actor, "deactivate_template", "template", template.id, request, new_value=template.document_type)
    db.commit()
    db.refresh(template)
    return template
