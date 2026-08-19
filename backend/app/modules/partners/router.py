from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import audit, get_current_user, require_roles
from . import service
from app.modules.users.models import User
from .schemas import PartnerCreate, PartnerOut

router = APIRouter(prefix="/partners", tags=["Partners"])


@router.get("", response_model=list[PartnerOut])
def list_partners(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return service.list_partners(db)


@router.post("", response_model=PartnerOut, status_code=status.HTTP_201_CREATED)
def create_partner(
    payload: PartnerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "director_linkages", "researcher")),
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
    actor: User = Depends(require_roles("linkages", "director_linkages")),
):
    try:
        partner, old = service.update_partner(db, partner_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    audit(db, actor, "update_partner", "partner", partner.id, request, old_value=old, new_value=partner.name)
    db.commit()
    db.refresh(partner)
    return partner
