from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import audit, get_current_user, require_roles
from . import service
from app.modules.users.models import User
from .schemas import (
    PartnerCreate,
    PartnerOut,
    PartnerReviewCreate,
    PartnerReviewOut,
)

router = APIRouter(prefix="/partners", tags=["Partners"])


@router.get("", response_model=list[PartnerOut])
def list_partners(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return service.list_partners(db)


@router.post("", response_model=PartnerOut, status_code=status.HTTP_201_CREATED)
def create_partner(
    payload: PartnerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "researcher")),
):
    try:
        partner = service.create_partner(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    audit(db, actor, "create_partner", "partner", partner.id, request, new_value=partner.name)
    db.commit()
    db.refresh(partner)
    return partner


@router.put("/{partner_id}", response_model=PartnerOut)
def update_partner(
    partner_id: int,
    payload: PartnerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    existing = service.get_partner(db, partner_id)
    old_contact = existing.contact_email if existing else None
    try:
        partner, old = service.update_partner(db, partner_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    audit(db, actor, "update_partner", "partner", partner.id, request, old_value=old, new_value=partner.name)
    db.commit()
    if (old_contact or "").strip().lower() != (partner.contact_email or "").strip().lower():
        # The previous contact loses Doc access immediately.
        from app.modules.agreements.service import reconcile_agreements_for_people

        reconcile_agreements_for_people(db, emails={old_contact} if old_contact else set(), partner_id=partner.id, notify=True)
    db.refresh(partner)
    return partner


@router.get("/{partner_id}/reviews", response_model=list[PartnerReviewOut])
def list_partner_reviews(
    partner_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("linkages")),
):
    if not service.get_partner(db, partner_id):
        raise HTTPException(status_code=404, detail="Partner not found")
    return service.list_partner_reviews(db, partner_id)


@router.post("/{partner_id}/review", response_model=PartnerReviewOut, status_code=status.HTTP_201_CREATED)
def review_partner(
    partner_id: int,
    payload: PartnerReviewCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages")),
):
    try:
        return service.review_partner(db, partner_id, payload, actor, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
