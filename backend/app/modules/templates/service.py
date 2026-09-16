from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.deps import audit
from app.timeutils import utc_now

from .models import Template
from .schemas import TemplateCreate, TemplateUpdate

MAX_TEMPLATE_BYTES = 25 * 1024 * 1024
ALLOWED_TEMPLATE_EXTENSIONS = {".doc", ".docx", ".pdf", ".odt"}


def list_templates(db: Session, agreement_type: str | None = None, include_archived: bool = False) -> list[Template]:
    statement = select(Template).order_by(Template.agreement_type, Template.name, Template.version)
    if agreement_type:
        statement = statement.where(Template.agreement_type == agreement_type)
    if not include_archived:
        statement = statement.where(Template.status == "active")
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
    mime_type: str | None = None,
) -> Template:
    if db.scalar(select(Template).where(Template.name == payload.name, Template.version == payload.version)):
        raise ValueError("A template with this name and version already exists")
    stored_name = None
    if content is not None:
        suffix = Path(original_name or "template").suffix.lower()
        if suffix not in ALLOWED_TEMPLATE_EXTENSIONS:
            raise ValueError("Only DOC, DOCX, ODT and PDF templates are accepted")
        if len(content) > MAX_TEMPLATE_BYTES:
            raise ValueError("Template files must be 25 MB or smaller")
        stored_name = f"templates/{uuid4().hex}{suffix}"
        target = settings.upload_path / stored_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    template = Template(
        **payload.model_dump(),
        original_name=Path(original_name).name if original_name else None,
        stored_name=stored_name,
        mime_type=mime_type,
        size_bytes=len(content or b""),
        uploaded_by_id=actor.id,
        created_at=utc_now(),
    )
    db.add(template)
    db.flush()
    audit(db, actor, "create_template", "template", template.id, request, new_value=f"{template.name} v{template.version}")
    db.commit()
    db.refresh(template)
    return template


def update_template(db: Session, template_id: int, payload: TemplateUpdate, actor, request) -> Template:
    template = db.get(Template, template_id)
    if not template:
        raise LookupError("Template not found")
    old = template.status
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    audit(db, actor, "update_template", "template", template.id, request, old_value=old, new_value=template.status)
    db.commit()
    db.refresh(template)
    return template
