from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Agreement, Deliverable, User, ValueRecord
from ..schemas import DeliverableCreate, DeliverableOut, ValueRecordCreate, ValueRecordOut

router = APIRouter(prefix="/agreements/{agreement_id}", tags=["Monitoring and Evaluation"])


def _can_manage_me(user: User, agreement: Agreement) -> bool:
    if agreement.stage != "active":
        return False
    if user.role in {"admin", "linkages", "me"}:
        return True
    return user.role == "researcher" and agreement.owner_id == user.id


@router.post("/deliverables", response_model=DeliverableOut, status_code=status.HTTP_201_CREATED)
def create_deliverable(
    agreement_id: int,
    payload: DeliverableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not _can_manage_me(user, agreement):
        raise HTTPException(status_code=403, detail="M&E updates are limited to active agreements and authorized users")
    item = Deliverable(agreement_id=agreement_id, **payload.model_dump(), last_updated_at=datetime.utcnow())
    db.add(item)
    db.flush()
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
    agreement = db.get(Agreement, agreement_id)
    item = db.scalar(select(Deliverable).where(Deliverable.id == deliverable_id, Deliverable.agreement_id == agreement_id))
    if not agreement or not item:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if not _can_manage_me(user, agreement):
        raise HTTPException(status_code=403, detail="M&E updates are limited to active agreements and authorized users")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.last_updated_at = datetime.utcnow()
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
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if agreement.stage != "active" or user.role not in {"admin", "linkages", "me", "executive"}:
        raise HTTPException(status_code=403, detail="Value records are limited to active agreements and authorized roles")
    item = ValueRecord(agreement_id=agreement_id, **payload.model_dump())
    db.add(item)
    db.flush()
    audit(db, user, "create_value_record", "value_record", item.id, request, new_value=f"{item.currency} {item.amount}")
    db.commit()
    db.refresh(item)
    return item
