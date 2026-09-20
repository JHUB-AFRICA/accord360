from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.deps import get_current_user, require_roles
from app.modules.users.models import User

from . import service
from .schemas import FieldDefinitionOut, TemplateCreate, TemplateOut

router = APIRouter(prefix="/templates", tags=["Templates"])


def _template_out(db: Session, template) -> TemplateOut:
    return TemplateOut.model_validate(template).model_copy(update=service.template_response_data(db, template))


@router.get("", response_model=list[TemplateOut])
def list_templates(
    document_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return [_template_out(db, item) for item in service.list_templates(db, document_type)]


@router.get("/fields", response_model=list[FieldDefinitionOut])
def list_field_definitions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.list_field_definitions(db)


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    request: Request,
    document_type: str = Form(..., min_length=2, max_length=120),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        content = await file.read()
        payload = TemplateCreate(document_type=document_type)
        template = service.create_template(db, payload, actor, request, content, file.filename)
        return TemplateOut.model_validate(template).model_copy(update=service.validate_docx_placeholders(db, content))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{template_id}/activate", response_model=TemplateOut)
def activate_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        return _template_out(db, service.activate_template(db, template_id, actor, request))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{template_id}/deactivate", response_model=TemplateOut)
def deactivate_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        return _template_out(db, service.deactivate_template(db, template_id, actor, request))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{template_id}/download")
def download_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    template = service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    path = settings.upload_path / template.file
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Template file is unavailable")
    return FileResponse(path, filename=path.name)
