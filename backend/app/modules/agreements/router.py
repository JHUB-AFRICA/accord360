from __future__ import annotations

from pathlib import Path
import re
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status, HTTPException
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...core.config import settings
from ...utils import storage
from ...deps import get_current_user
from ...deps import require_roles
from app.modules.users.models import User
from .schemas import (
    AgreementCreate,
    AgreementDetailOut,
    AgreementListOut,
    AgreementUpdate,
    ProgressUpdateCreate,
    ProgressUpdateOut,
)
from app.modules.workflows.schemas import TransitionRequest
from . import service

router = APIRouter(prefix="/agreements", tags=["Agreements"])
progress_router = APIRouter(tags=["Progress updates"])


@router.get("", response_model=list[AgreementListOut])
def list_agreements(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    department: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.list_agreements(
        db,
        user,
        search=search,
        status_filter=status_filter,
        department=department,
    )


@router.post("", response_model=AgreementDetailOut, status_code=status.HTTP_201_CREATED)
def create_agreement(
    payload: AgreementCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.create_agreement(db, user, payload, request)


@router.get("/{agreement_id}", response_model=AgreementDetailOut)
def get_agreement(
    agreement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.get_agreement_detail(db, user, agreement_id)


@router.patch("/{agreement_id}", response_model=AgreementDetailOut)
def update_agreement(
    agreement_id: int,
    payload: AgreementUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.update_agreement(db, user, agreement_id, payload, request)


@router.post("/{agreement_id}/transition", response_model=AgreementDetailOut)
def transition_agreement(
    agreement_id: int,
    payload: TransitionRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.transition_agreement(db, user, agreement_id, payload, request)


@router.post("/{agreement_id}/drive-access/reconcile")
def reconcile_drive_access(
    agreement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("linkages")),
):
    """Repair the agreement's direct Google Drive permissions.

    Linkages is the operational owner of document hand-offs.  The reconciler
    is idempotent and computes access from the agreement's current status, so
    this endpoint is safe to retry after a transient Drive failure.
    """
    agreement = db.get(service.Agreement, agreement_id)
    if not agreement:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agreement not found")
    from ...access import ensure_can_view_agreement
    ensure_can_view_agreement(user, agreement)
    try:
        result = service.reconcile_drive_access(db, agreement)
    except service.DriveError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    db.commit()
    return result


@router.get("/{agreement_id}/drive-access")
def inspect_drive_access(
    agreement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("linkages")),
):
    agreement = db.get(service.Agreement, agreement_id)
    if not agreement:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agreement not found")
    from ...access import ensure_can_view_agreement
    ensure_can_view_agreement(user, agreement)
    try:
        return service.inspect_drive_access(db, agreement)
    except service.DriveError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/{agreement_id}/versions", response_model=AgreementDetailOut)
async def upload_final_signed_document(
    agreement_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("linkages")),
):
    content = await file.read(service.MAX_SIGNED_FILE_SIZE + 1)
    return service.upload_final_signed_document(
        db, user, agreement_id, content, file.filename, request, content_type=file.content_type
    )


@router.get("/{agreement_id}/signing-copy")
def export_signing_copy(
    agreement_id: int,
    format: str = Query(..., pattern="^(pdf|docx)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("linkages")),
):
    payload, content_type, filename = service.export_signing_copy(db, user, agreement_id, format)
    return Response(
        content=payload,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{agreement_id}/versions/{version_id}/download")
def download_version(
    agreement_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = service.get_agreement_for_version(db, user, agreement_id, version_id)
    filename = agreement.original_filename or Path(agreement.file).name
    filename = re.sub(r"[^A-Za-z0-9._ -]+", "-", Path(filename).name).strip() or "signed-agreement"
    media_type = agreement.content_type or "application/octet-stream"
    if settings.storage_enabled:
        try:
            return StreamingResponse(storage.download_file(agreement.file), media_type=media_type,
                                     headers={"Content-Disposition": f'attachment; filename="{filename}"'})
        except storage.StorageError as exc:
            raise HTTPException(status_code=404, detail="Agreement version file is unavailable") from exc
    path = settings.upload_path / agreement.file
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Agreement version file is unavailable")
    return FileResponse(path, filename=filename, media_type=media_type)


@progress_router.post("/agreements/{agreement_id}/progress-updates", response_model=ProgressUpdateOut, status_code=status.HTTP_201_CREATED)
def create_agreement_progress_update(
    agreement_id: int,
    payload: ProgressUpdateCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.create_progress_update(db, user, agreement_id, payload, request)


@progress_router.get("/progress-updates", response_model=list[ProgressUpdateOut])
def list_all_progress_updates(
    agreement_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.list_progress_updates(db, user, agreement_id)
