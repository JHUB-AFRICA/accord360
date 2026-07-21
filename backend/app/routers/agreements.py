from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Agreement, Notification, Partner, User, WorkflowEvent
from ..schemas import AgreementCreate, AgreementDetailOut, AgreementListOut, AgreementUpdate, TransitionRequest
from ..services import ALLOWED_BY_ROLE, ALLOWED_BY_STAGE, TRANSITIONS, create_reference, notify_roles, refresh_risk_status

router = APIRouter(prefix="/agreements", tags=["Agreements"])

LOAD_OPTIONS = (
    selectinload(Agreement.partner),
    selectinload(Agreement.owner),
    selectinload(Agreement.documents),
    selectinload(Agreement.workflow_events).selectinload(WorkflowEvent.actor),
    selectinload(Agreement.deliverables),
    selectinload(Agreement.values),
)


def scoped_query(user: User):
    stmt = select(Agreement).options(selectinload(Agreement.partner), selectinload(Agreement.owner))
    if user.role == "researcher":
        stmt = stmt.where(Agreement.owner_id == user.id)
    elif user.role == "approver":
        stmt = stmt.where(or_(Agreement.assigned_approver_id == user.id, Agreement.department == user.department))
    elif user.role == "legal":
        stmt = stmt.where(or_(Agreement.legal_reviewer_id == user.id, Agreement.stage == "legal_review"))
    return stmt


def can_access_agreement(user: User, agreement: Agreement) -> bool:
    if user.role in {"admin", "linkages", "executive", "auditor"}:
        return True
    if user.role == "researcher":
        return agreement.owner_id == user.id
    if user.role == "approver":
        return agreement.assigned_approver_id == user.id or agreement.department == user.department
    if user.role == "legal":
        return agreement.legal_reviewer_id == user.id or agreement.stage == "legal_review"
    if user.role == "me":
        return agreement.stage == "active"
    return False


@router.get("", response_model=list[AgreementListOut])
def list_agreements(
    search: str | None = None,
    stage: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    agreement_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = scoped_query(user)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Agreement.title.ilike(pattern), Agreement.reference_number.ilike(pattern)))
    if stage:
        stmt = stmt.where(Agreement.stage == stage)
    if status_filter:
        stmt = stmt.where(Agreement.status == status_filter)
    if agreement_type:
        stmt = stmt.where(Agreement.agreement_type == agreement_type)
    agreements = db.scalars(stmt.order_by(Agreement.updated_at.desc())).all()
    for item in agreements:
        refresh_risk_status(item)
    db.commit()
    return agreements


@router.post("", response_model=AgreementDetailOut, status_code=status.HTTP_201_CREATED)
def create_agreement(
    payload: AgreementCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in {"researcher", "linkages", "admin"}:
        raise HTTPException(status_code=403, detail="Only researchers, Linkages and administrators can create requests")
    partner = db.get(Partner, payload.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    agreement = Agreement(
        **payload.model_dump(),
        reference_number=create_reference(db, payload.agreement_type),
        owner_id=user.id,
        next_action="Complete the request and submit for departmental approval",
    )
    db.add(agreement)
    db.flush()
    db.add(WorkflowEvent(agreement_id=agreement.id, from_stage=None, to_stage="initiation", action="create", comment="Agreement request created", actor_id=user.id))
    audit(db, user, "create_agreement", "agreement", agreement.id, request, new_value=agreement.reference_number)
    notify_roles(db, {"admin", "linkages"}, "New agreement request", f"{agreement.reference_number} was created by {user.full_name}.", agreement.id)
    db.commit()
    return get_agreement(agreement.id, db, user)


@router.get("/{agreement_id}", response_model=AgreementDetailOut)
def get_agreement(
    agreement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id).options(*LOAD_OPTIONS))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not can_access_agreement(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    refresh_risk_status(agreement)
    db.commit()
    return agreement


@router.patch("/{agreement_id}", response_model=AgreementDetailOut)
def update_agreement(
    agreement_id: int,
    payload: AgreementUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not can_access_agreement(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    changes = payload.model_dump(exclude_unset=True)
    if user.role == "researcher":
        if agreement.stage != "initiation":
            raise HTTPException(status_code=403, detail="Submitted requests can only be changed after they are returned for correction")
        allowed = {"title", "purpose", "expected_outcomes", "strategic_alignment", "department", "confidentiality"}
        if set(changes) - allowed:
            raise HTTPException(status_code=403, detail="Researchers cannot edit lifecycle administration fields")
    elif user.role not in {"admin", "linkages"}:
        raise HTTPException(status_code=403, detail="Your role has read-only access to these agreement details")
    old = json.dumps({"title": agreement.title, "stage": agreement.stage, "status": agreement.status})
    for key, value in changes.items():
        setattr(agreement, key, value)
    audit(db, user, "update_agreement", "agreement", agreement.id, request, old_value=old, new_value=json.dumps(changes, default=str))
    db.commit()
    return get_agreement(agreement.id, db, user)


@router.post("/{agreement_id}/transition", response_model=AgreementDetailOut)
def transition_agreement(
    agreement_id: int,
    payload: TransitionRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not can_access_agreement(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    allowed_roles = ALLOWED_BY_ROLE[payload.action]
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role '{user.role}' cannot perform '{payload.action}'")
    if agreement.stage not in ALLOWED_BY_STAGE[payload.action]:
        raise HTTPException(status_code=400, detail=f"Action '{payload.action}' is not valid while the agreement is in '{agreement.stage}'")
    if payload.action == "activate" and agreement.status != "fully_signed":
        raise HTTPException(status_code=400, detail="Mark the agreement as fully signed before activation")
    if payload.action == "activate":
        missing = []
        if not agreement.effective_date:
            missing.append("effective date")
        if not agreement.expiry_date:
            missing.append("expiry date")
        if not agreement.internal_champion:
            missing.append("internal champion")
        if not agreement.partner_liaison:
            missing.append("partner liaison")
        if missing:
            raise HTTPException(status_code=400, detail=f"Activation requires: {', '.join(missing)}")
    from_stage = agreement.stage
    new_stage, new_status, color, next_action = TRANSITIONS[payload.action]
    agreement.stage = new_stage
    agreement.status = new_status
    agreement.status_color = color
    agreement.next_action = next_action
    now = datetime.utcnow()
    if payload.action == "submit":
        agreement.submitted_at = now
    elif payload.action in {"approve_linkages", "send_legal"} and not agreement.legal_review_started_at:
        agreement.legal_review_started_at = now
    elif payload.action == "activate":
        agreement.activated_at = now
    db.add(WorkflowEvent(agreement_id=agreement.id, from_stage=from_stage, to_stage=new_stage, action=payload.action, comment=payload.comment, actor_id=user.id))
    audit(db, user, f"workflow_{payload.action}", "agreement", agreement.id, request, old_value=from_stage, new_value=new_stage)
    db.add(Notification(user_id=agreement.owner_id, title="Agreement status updated", message=f"{agreement.reference_number} moved to {new_stage.replace('_', ' ')}.", level=color, agreement_id=agreement.id))
    notify_roles(db, {"admin", "linkages"}, "Workflow update", f"{agreement.reference_number}: {payload.action.replace('_', ' ')} by {user.full_name}.", agreement.id, color)
    db.commit()
    return get_agreement(agreement.id, db, user)
