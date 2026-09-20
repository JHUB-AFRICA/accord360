from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...core.config import settings
from ...deps import get_current_user
from ...deps import require_roles
from app.modules.users.models import User
from .schemas import AgreementCreate, AgreementDetailOut, AgreementListOut, AgreementUpdate
from app.modules.workflows.schemas import TransitionRequest
from . import service

router = APIRouter(prefix="/agreements", tags=["Agreements"])


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


@router.post("/{agreement_id}/versions", response_model=AgreementDetailOut)
async def upload_initial_draft(
    agreement_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("linkages")),
):
    content = await file.read()
    return service.upload_initial_draft(db, user, agreement_id, content, file.filename, request)


@router.get("/{agreement_id}/versions/{version_id}/download")
def download_version(
    agreement_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = service.get_agreement_for_version(db, user, agreement_id, version_id)
    path = settings.upload_path / agreement.file
    if not path.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agreement version file is unavailable")
    return FileResponse(path, filename=path.name)
