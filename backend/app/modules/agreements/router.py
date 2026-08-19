from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import get_current_user
from app.modules.users.models import User
from .schemas import AgreementCreate, AgreementDetailOut, AgreementListOut, AgreementUpdate
from app.modules.workflows.schemas import TransitionRequest
from . import service

router = APIRouter(prefix="/agreements", tags=["Agreements"])


@router.get("", response_model=list[AgreementListOut])
def list_agreements(
    search: str | None = None,
    stage: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    agreement_type: str | None = None,
    department: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.list_agreements(
        db,
        user,
        search=search,
        stage=stage,
        status_filter=status_filter,
        agreement_type=agreement_type,
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
