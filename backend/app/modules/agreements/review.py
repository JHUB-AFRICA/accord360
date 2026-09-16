from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import require_roles
from ...models import Agreement, User
from ...timeutils import utc_now
from . import service
from .schemas import AgreementDetailOut, AgreementListOut, HistoricalReviewUpdate, HistoricalReviewVerify

router = APIRouter(prefix="/data-review", tags=["Historical data review"])
REVIEW_ROLES = ("linkages", "director_linkages", "admin")


@router.get("/summary")
def review_summary(db: Session = Depends(get_db), _: User = Depends(require_roles(*REVIEW_ROLES))):
    rows = db.execute(select(Agreement.data_quality_status, func.count(Agreement.id)).group_by(Agreement.data_quality_status)).all()
    return {"counts": {status: count for status, count in rows}, "generated_at": utc_now()}


@router.get("", response_model=list[AgreementListOut])
def review_queue(status: str = "pending_review", db: Session = Depends(get_db), _: User = Depends(require_roles(*REVIEW_ROLES))):
    query = select(Agreement).where(Agreement.data_quality_status == status).options(*service.LOAD_OPTIONS).order_by(Agreement.source_row_number, Agreement.id)
    return db.scalars(query).all()


@router.get("/{agreement_id}", response_model=AgreementDetailOut)
def review_detail(agreement_id: int, db: Session = Depends(get_db), reviewer: User = Depends(require_roles(*REVIEW_ROLES))):
    return service._review_agreement(db, agreement_id)


@router.patch("/{agreement_id}", response_model=AgreementDetailOut)
def update_review(agreement_id: int, payload: HistoricalReviewUpdate, request: Request, db: Session = Depends(get_db), reviewer: User = Depends(require_roles(*REVIEW_ROLES))):
    return service.update_historical_review(db, reviewer, agreement_id, payload, request)


@router.post("/{agreement_id}/verify", response_model=AgreementDetailOut)
def verify_review(agreement_id: int, payload: HistoricalReviewVerify, request: Request, db: Session = Depends(get_db), reviewer: User = Depends(require_roles(*REVIEW_ROLES))):
    return service.verify_historical_review(db, reviewer, agreement_id, payload, request)
