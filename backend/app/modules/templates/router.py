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


@router.get("", response_model=list[TemplateOut])
def list_templates(
    document_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.list_templates(db, document_type)


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
    master_doc_id: str = Form(..., min_length=1, max_length=120),
    # GOOGLE_DOCS_DRAFTING_BRIEF.md Phase D: the actual drafting copy comes
    # from master_doc_id via the Drive API — this optional upload is only
    # Linkages' own reference copy, never parsed or rendered by Accord 360.
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        content = await file.read() if file else None
        payload = TemplateCreate(document_type=document_type, master_doc_id=master_doc_id)
        return service.create_template(db, payload, actor, request, content, file.filename if file else None)
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
        return service.activate_template(db, template_id, actor, request)
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
        return service.deactivate_template(db, template_id, actor, request)
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
    if not template.file:
        raise HTTPException(status_code=404, detail="No reference file was uploaded for this template")
    path = settings.upload_path / template.file
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Template file is unavailable")
    return FileResponse(path, filename=path.name)
