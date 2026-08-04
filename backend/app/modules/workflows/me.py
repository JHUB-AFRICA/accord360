from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ...access import can_manage_me, can_manage_value, ensure_can_view_agreement
from ...db.session import get_db
from ...deps import audit, get_current_user
from ...models import Agreement, Deliverable, Document, User, ValueRecord
from ...schemas import DeliverableCreate, DeliverableOut, ValueRecordCreate, ValueRecordOut
from ...services import refresh_risk_status
from ...timeutils import utc_now

router = APIRouter(prefix="/agreements/{agreement_id}", tags=["Monitoring and Evaluation"])


def _agreement(db: Session, agreement_id: int) -> Agreement:
    agreement = db.scalar(
        select(Agreement)
        .where(Agreement.id == agreement_id)
        .options(selectinload(Agreement.deliverables))
    )
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agreement


def _validate_evidence(db: Session, agreement_id: int, document_id: int | None) -> None:
    if document_id is None:
        return
    exists = db.scalar(
        select(Document.id).where(
            Document.id == document_id,
            Document.agreement_id == agreement_id,
        )
    )
    if not exists:
        raise HTTPException(status_code=400, detail="Evidence document must belong to this agreement")


@router.post("/deliverables", response_model=DeliverableOut, status_code=status.HTTP_201_CREATED)
def create_deliverable(
    agreement_id: int,
    payload: DeliverableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = _agreement(db, agreement_id)
    ensure_can_view_agreement(user, agreement)
    if not can_manage_me(user, agreement):
        raise HTTPException(status_code=403, detail="You cannot update M&E for this agreement")
    _validate_evidence(db, agreement_id, payload.evidence_document_id)
    item = Deliverable(agreement_id=agreement_id, **payload.model_dump(), last_updated_at=utc_now())
    db.add(item)
    db.flush()
    refresh_risk_status(agreement)
    audit(db, user, "create_deliverable", "deliverable", item.id, request, new_value=item.deliverable_type)
    db.commit()
    db.refresh(item)
    return item


@router.put("/deliverables/{deliverable_id}", response_model=DeliverableOut)
def update_deliverable(
    agreement_id: int,
    deliverable_id: int,
    payload: DeliverableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = _agreement(db, agreement_id)
    ensure_can_view_agreement(user, agreement)
    if not can_manage_me(user, agreement):
        raise HTTPException(status_code=403, detail="You cannot update M&E for this agreement")
    item = db.scalar(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.agreement_id == agreement_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    _validate_evidence(db, agreement_id, payload.evidence_document_id)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.last_updated_at = utc_now()
    refresh_risk_status(agreement)
    audit(db, user, "update_deliverable", "deliverable", item.id, request, new_value=f"actual={item.actual_value}")
    db.commit()
    db.refresh(item)
    return item


@router.post("/values", response_model=ValueRecordOut, status_code=status.HTTP_201_CREATED)
def create_value_record(
    agreement_id: int,
    payload: ValueRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = _agreement(db, agreement_id)
    ensure_can_view_agreement(user, agreement)
    if not can_manage_value(user, agreement):
        raise HTTPException(status_code=403, detail="You cannot add value records for this agreement")
    data = payload.model_dump()
    data["currency"] = payload.currency.strip().upper()
    if user.role == "me":
        data["approved"] = False
    item = ValueRecord(agreement_id=agreement_id, **data)
    db.add(item)
    db.flush()
    audit(db, user, "create_value_record", "value_record", item.id, request, new_value=f"{item.currency} {item.amount}")
    db.commit()
    db.refresh(item)
    return item

