from __future__ import annotations

from io import BytesIO
from pathlib import Path
import re
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.deps import audit
from app.timeutils import utc_now

from .models import FieldDefinition, Template
from .schemas import TemplateCreate

MAX_TEMPLATE_BYTES = 25 * 1024 * 1024
ALLOWED_TEMPLATE_EXTENSIONS = {".docx"}
PLACEHOLDER_PATTERN = re.compile(r"{{([^{}]*)}}")
VALID_PLACEHOLDER_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


def list_field_definitions(db: Session) -> list[FieldDefinition]:
    return db.scalars(select(FieldDefinition).order_by(FieldDefinition.id)).all()


def _document_text(document) -> str:
    chunks: list[str] = []
    for paragraph in document.paragraphs:
        chunks.append(paragraph.text)
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                chunks.append(cell.text)
    for section in document.sections:
        for container in (section.header, section.footer):
            chunks.extend(paragraph.text for paragraph in container.paragraphs)
            for table in container.tables:
                for row in table.rows:
                    for cell in row.cells:
                        chunks.append(cell.text)
    return "\n".join(chunks)


def validate_docx_placeholders(db: Session, content: bytes) -> dict[str, object]:
    """Return the required/present/unknown placeholder summary for a .docx."""
    from docx import Document

    document = Document(BytesIO(content))
    text = _document_text(document)
    tokens = sorted(set(PLACEHOLDER_PATTERN.findall(text)))
    known = {item.field_name for item in list_field_definitions(db)}
    required = {item.field_name for item in list_field_definitions(db) if item.required}
    present = sorted(token for token in tokens if token in known)
    unknown = sorted(token for token in tokens if token not in known or not VALID_PLACEHOLDER_PATTERN.fullmatch(token))
    missing_required = sorted(required - set(present))
    return {
        "present": present,
        "missing_required": missing_required,
        "unknown_tokens": unknown,
        "validated": not missing_required and not unknown,
    }


def template_response_data(db: Session, template: Template) -> dict[str, object]:
    path = settings.upload_path / template.file
    if path.is_file() and path.suffix.lower() == ".docx":
        return validate_docx_placeholders(db, path.read_bytes())
    return {"present": [], "missing_required": [], "unknown_tokens": [], "validated": False}


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
    content: bytes,
    original_name: str | None,
) -> Template:
    suffix = Path(original_name or "template").suffix.lower()
    if suffix not in ALLOWED_TEMPLATE_EXTENSIONS:
        raise ValueError("Only .docx templates are accepted")
    if len(content) > MAX_TEMPLATE_BYTES:
        raise ValueError("Template files must be 25 MB or smaller")
    stored_name = f"templates/{uuid4().hex}{suffix}"
    target = settings.upload_path / stored_name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

    # New templates always start inactive; activation is a separate,
    # explicit call so the exclusivity invariant below is only enforced there.
    template = Template(
        document_type=payload.document_type,
        file=stored_name,
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
    document_type has is_active=true.
    """
    template = db.get(Template, template_id)
    if not template:
        raise LookupError("Template not found")
    summary = template_response_data(db, template)
    if summary["missing_required"]:
        raise ValueError("Template is missing required placeholders: " + ", ".join(summary["missing_required"]))

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


def generate_document(template: Template, values: dict[str, object]) -> bytes:
    """Merge structured Researcher values into a Linkages template."""
    from docxtpl import DocxTemplate

    source = settings.upload_path / template.file
    if not source.is_file():
        raise FileNotFoundError("The active template file is unavailable")
    output = BytesIO()
    document = DocxTemplate(str(source))
    document.render(values)
    document.save(output)
    return output.getvalue()


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
