from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import get_current_user
from app.modules.users.models import User
from .schemas import CorrectionOut, CorrectionResolution, CorrectionResponse
from . import service

router = APIRouter(prefix="/corrections", tags=["Corrections"])


@router.get("", response_model=list[CorrectionOut])
def list_corrections(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.list_corrections(db, user)


@router.get("/{correction_id}", response_model=CorrectionOut)
def get_correction(correction_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        return service.get_correction(db, user, correction_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{correction_id}/respond", response_model=CorrectionOut)
def respond_to_correction(
    correction_id: int,
    payload: CorrectionResponse,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return service.respond_to_correction(db, user, correction_id, payload, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{correction_id}/resolve", response_model=CorrectionOut)
def resolve_correction(
    correction_id: int,
    payload: CorrectionResolution,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return service.resolve_correction(db, user, correction_id, payload, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
