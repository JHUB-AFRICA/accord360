from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import PartnerRequest, User
from ..schemas import PartnerRequestAssign, PartnerRequestCreate, PartnerRequestOut
from ..services import notify_user

router = APIRouter(prefix="/partner-requests", tags=["Partner Request Intake"])

LOAD = (selectinload(PartnerRequest.champion), selectinload(PartnerRequest.logged_by))


@router.get("", response_model=list[PartnerRequestOut])
def list_requests(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(PartnerRequest).options(*LOAD).order_by(PartnerRequest.created_at.desc())
    if user.role == "champion":
        # Champions only see intake requests routed to them (least privilege).
        stmt = stmt.where(PartnerRequest.champion_id == user.id)
    elif user.role not in {"admin", "linkages", "executive", "auditor"}:
        raise HTTPException(status_code=403, detail="Your role does not have access to partner request intake")
    if status_filter:
        stmt = stmt.where(PartnerRequest.status == status_filter)
    return db.scalars(stmt).all()


@router.post("", response_model=PartnerRequestOut, status_code=status.HTTP_201_CREATED)
def log_request(
    payload: PartnerRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "admin")),
):
    """FR-004: Linkages logs a partner-originated collaboration request."""
    item = PartnerRequest(**payload.model_dump(), logged_by_id=actor.id)
    db.add(item)
    db.flush()
    audit(db, actor, "log_partner_request", "partner_request", item.id, request, new_value=item.partner_name)
    db.commit()
    return db.scalar(select(PartnerRequest).where(PartnerRequest.id == item.id).options(*LOAD))


@router.post("/{request_id}/assign-champion", response_model=PartnerRequestOut)
def assign_champion(
    request_id: int,
    payload: PartnerRequestAssign,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "admin")),
):
    """BR-002 / FR-003: route the request to an internal JKUAT Champion.

    Drafting is blocked until this assignment exists.
    """
    item = db.scalar(select(PartnerRequest).where(PartnerRequest.id == request_id).options(*LOAD))
    if not item:
        raise HTTPException(status_code=404, detail="Partner request not found")
    if item.status == "converted":
        raise HTTPException(status_code=400, detail="This request has already been converted to an agreement")
    champion = db.get(User, payload.champion_id)
    if not champion or not champion.is_active or champion.role != "champion":
        raise HTTPException(status_code=400, detail="Select an active internal JKUAT Champion")
    old = str(item.champion_id)
    item.champion_id = champion.id
    item.status = "champion_assigned"
    audit(db, actor, "assign_champion", "partner_request", item.id, request, old_value=old, new_value=str(champion.id))
    notify_user(
        db,
        champion.id,
        "You have been assigned as JKUAT Champion",
        f"Linkages routed the partner request from {item.partner_name} to you. Please initiate the agreement request.",
    )
    db.commit()
    return db.scalar(select(PartnerRequest).where(PartnerRequest.id == item.id).options(*LOAD))


@router.post("/{request_id}/decline", response_model=PartnerRequestOut)
def decline_request(
    request_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "admin")),
):
    item = db.scalar(select(PartnerRequest).where(PartnerRequest.id == request_id).options(*LOAD))
    if not item:
        raise HTTPException(status_code=404, detail="Partner request not found")
    if item.status == "converted":
        raise HTTPException(status_code=400, detail="Converted requests cannot be declined")
    item.status = "declined"
    audit(db, actor, "decline_partner_request", "partner_request", item.id, request)
    db.commit()
    return db.scalar(select(PartnerRequest).where(PartnerRequest.id == item.id).options(*LOAD))
