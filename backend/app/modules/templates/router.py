from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.deps import get_current_user, require_roles
from app.modules.users.models import User

from . import service
from .schemas import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    agreement_type: str | None = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.list_templates(db, agreement_type, include_archived)


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    request: Request,
    name: str = Form(..., min_length=2, max_length=240),
    agreement_type: str = Form(...),
    version: str = Form(..., min_length=1, max_length=30),
    description: str | None = Form(None, max_length=4000),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        content = await file.read() if file else None
        payload = TemplateCreate(name=name, agreement_type=agreement_type, version=version, description=description)
        return service.create_template(db, payload, actor, request, content, file.filename if file else None, file.content_type if file else None)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        return service.update_template(db, template_id, payload, actor, request)
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
    if not template.stored_name:
        raise HTTPException(status_code=404, detail="This template has no uploaded file")
    path = settings.upload_path / template.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Template file is unavailable")
    return FileResponse(path, media_type=template.mime_type or "application/octet-stream", filename=template.original_name or path.name)
