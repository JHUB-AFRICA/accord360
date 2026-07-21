from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import Partner, User
from ..schemas import PartnerCreate, PartnerOut

router = APIRouter(prefix="/partners", tags=["Partners"])


@router.get("", response_model=list[PartnerOut])
def list_partners(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Partner).order_by(Partner.name)).all()


@router.post("", response_model=PartnerOut, status_code=status.HTTP_201_CREATED)
def create_partner(
    payload: PartnerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages", "researcher")),
):
    if db.scalar(select(Partner).where(Partner.name == payload.name)):
        raise HTTPException(status_code=409, detail="Partner already exists")
    partner = Partner(**payload.model_dump())
    db.add(partner)
    db.flush()
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
    actor: User = Depends(require_roles("admin", "linkages")),
):
    partner = db.get(Partner, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    old = partner.name
    for key, value in payload.model_dump().items():
        setattr(partner, key, value)
    audit(db, actor, "update_partner", "partner", partner.id, request, old_value=old, new_value=partner.name)
    db.commit()
    db.refresh(partner)
    return partner
