"""Agreement domain service.

Holds the business logic for the agreement lifecycle: listing/scoping,
creation, detail retrieval, updates and workflow-stage transitions. Routers
in this module should only parse the request, call one of these functions,
and return/raise based on the result.
"""

from __future__ import annotations

import json
import uuid
from datetime import date

from fastapi import HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ...access import apply_agreement_scope, can_download_document, ensure_can_edit_agreement, ensure_can_view_agreement
from ...deps import audit
from .models import Agreement
from app.modules.partners.models import Partner
from app.modules.users.models import User
from app.modules.workflows.models import Notification, WorkflowEvent
from .schemas import AgreementCreate, AgreementDetailOut, AgreementUpdate, DocumentOut
from app.modules.workflows.schemas import TransitionRequest
from ..workflows.service import (
    ALLOWED_BY_ROLE,
    ALLOWED_BY_STAGE,
    COMMENT_REQUIRED_ACTIONS,
    REQUIRED_STATUS_BY_ACTION,
    TRANSITIONS,
    create_reference,
    notify_roles,
    refresh_risk_status,
)
from ...timeutils import utc_now

__all__ = [
    "create_reference",
    "notify_roles",
    "refresh_risk_status",
    "LOAD_OPTIONS",
    "scoped_query",
    "list_agreements",
    "create_agreement",
    "get_agreement_detail",
    "update_agreement",
    "transition_agreement",
]

LOAD_OPTIONS = (
    selectinload(Agreement.partner),
    selectinload(Agreement.owner),
    selectinload(Agreement.documents),
    selectinload(Agreement.workflow_events).selectinload(WorkflowEvent.actor),
    selectinload(Agreement.deliverables),
    selectinload(Agreement.values),
)

RESEARCHER_EDIT_FIELDS = {
    "title",
    "purpose",
    "expected_outcomes",
    "strategic_alignment",
    "department",
    "confidentiality",
}
VC_EDIT_FIELDS = {"date_sent_vc", "date_sent_partner", "signing_date", "next_action"}


def scoped_query(user: User):
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.owner),
        selectinload(Agreement.deliverables),
    )
    return apply_agreement_scope(stmt, user)


def _transition_recipient_roles(action: str) -> set[str]:
    mapping = {
        "submit": {"approver", "linkages", "director_linkages"},
        "approve_department": {"linkages", "director_linkages"},
        "approve_linkages": {"linkages", "director_linkages"},
        "send_legal": {"legal", "linkages", "director_linkages"},
        "approve_legal": {"dvc", "linkages", "director_linkages"},
        "approve_dvc": {"linkages", "director_linkages"},
        "return_dvc": {"legal", "linkages", "director_linkages"},
        "submit_vc": {"vc_office", "linkages", "director_linkages"},
        "record_vc_signature": {"vc_office", "linkages", "director_linkages"},
        "mark_signed": {"vc_office", "linkages", "director_linkages"},
        "activate": {"me", "linkages", "director_linkages", "executive"},
    }
    return mapping.get(action, {"linkages", "director_linkages"})


def list_agreements(
    db: Session,
    user: User,
    *,
    search: str | None,
    stage: str | None,
    status_filter: str | None,
    agreement_type: str | None,
    department: str | None,
):
    stmt = scoped_query(user)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Agreement.title.ilike(pattern),
                Agreement.reference_number.ilike(pattern),
                Agreement.partner.has(Partner.name.ilike(pattern)),
            )
        )
    if stage:
        stmt = stmt.where(Agreement.stage == stage)
    if status_filter:
        stmt = stmt.where(Agreement.status == status_filter)
    if agreement_type:
        stmt = stmt.where(Agreement.agreement_type == agreement_type)
    if department:
        stmt = stmt.where(Agreement.department == department)
    agreements = db.scalars(stmt.order_by(Agreement.updated_at.desc())).all()
    for item in agreements:
        refresh_risk_status(item)
    db.commit()
    return agreements


def create_agreement(db: Session, user: User, payload: AgreementCreate, request: Request) -> AgreementDetailOut:
    if user.role not in {"researcher", "linkages", "director_linkages"}:
        raise HTTPException(status_code=403, detail="Only Champions and Linkages officers can create collaboration requests")
    partner = db.get(Partner, payload.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if payload.effective_date and payload.expiry_date and payload.expiry_date <= payload.effective_date:
        raise HTTPException(status_code=400, detail="Expiry date must be after the effective date")

    data = payload.model_dump(exclude={"champion_user_id"})
    owner = user
    if user.role in {"linkages", "director_linkages"}:
        if payload.champion_user_id is None:
            raise HTTPException(status_code=400, detail="Linkages must assign an internal JKUAT Champion")
        owner = db.get(User, payload.champion_user_id)
        if not owner or not owner.is_active or owner.role != "researcher":
            raise HTTPException(status_code=400, detail="The assigned Champion must be an active JKUAT Champion account")
    if not data.get("internal_champion"):
        data["internal_champion"] = owner.full_name

    agreement = Agreement(
        **data,
        reference_number=f"PENDING-{uuid.uuid4().hex}",
        owner_id=owner.id,
        next_action="Complete the request and submit for departmental approval",
    )
    db.add(agreement)
    db.flush()
    agreement.reference_number = create_reference(payload.agreement_type, agreement.id)
    db.add(
        WorkflowEvent(
            agreement_id=agreement.id,
            from_stage=None,
            to_stage="initiation",
            action="create",
            comment="Collaboration request created",
            actor_id=user.id,
        )
    )
    audit(db, user, "create_agreement", "agreement", agreement.id, request, new_value=agreement.reference_number)
    notify_roles(db, {"linkages", "director_linkages"}, "New collaboration request", f"{agreement.reference_number} was created by {user.full_name} and assigned to {owner.full_name}.", agreement.id)
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def get_agreement_detail(db: Session, user: User, agreement_id: int) -> AgreementDetailOut:
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id).options(*LOAD_OPTIONS))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)
    refresh_risk_status(agreement)
    db.commit()
    result = AgreementDetailOut.model_validate(agreement)
    result.documents = [DocumentOut.model_validate(doc) for doc in agreement.documents if can_download_document(user, agreement, doc)]
    return result


def update_agreement(db: Session, user: User, agreement_id: int, payload: AgreementUpdate, request: Request) -> AgreementDetailOut:
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_edit_agreement(user, agreement)

    changes = payload.model_dump(exclude_unset=True)
    if user.role == "researcher":
        disallowed = set(changes) - RESEARCHER_EDIT_FIELDS
        if disallowed:
            raise HTTPException(status_code=403, detail=f"Champions cannot update: {', '.join(sorted(disallowed))}")
    if user.role == "vc_office":
        disallowed = set(changes) - VC_EDIT_FIELDS
        if disallowed:
            raise HTTPException(status_code=403, detail=f"VC Office cannot update: {', '.join(sorted(disallowed))}")

    effective_date = changes.get("effective_date", agreement.effective_date)
    expiry_date = changes.get("expiry_date", agreement.expiry_date)
    if effective_date and expiry_date and expiry_date <= effective_date:
        raise HTTPException(status_code=400, detail="Expiry date must be after the effective date")

    old = json.dumps({"title": agreement.title, "stage": agreement.stage, "status": agreement.status})
    for key, value in changes.items():
        setattr(agreement, key, value)
    audit(db, user, "update_agreement", "agreement", agreement.id, request, old_value=old, new_value=json.dumps(changes, default=str))
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def transition_agreement(db: Session, user: User, agreement_id: int, payload: TransitionRequest, request: Request) -> AgreementDetailOut:
    agreement = db.scalar(
        select(Agreement)
        .where(Agreement.id == agreement_id)
        .options(selectinload(Agreement.deliverables), selectinload(Agreement.documents))
    )
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)

    allowed_roles = ALLOWED_BY_ROLE[payload.action]
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role '{user.role}' cannot perform '{payload.action}'")
    if agreement.stage not in ALLOWED_BY_STAGE[payload.action]:
        raise HTTPException(status_code=400, detail=f"Action '{payload.action}' is not valid while the agreement is in '{agreement.stage}'")

    required_statuses = REQUIRED_STATUS_BY_ACTION.get(payload.action)
    if required_statuses and agreement.status not in required_statuses:
        expected = ", ".join(sorted(required_statuses))
        raise HTTPException(status_code=400, detail=f"Action '{payload.action}' requires status: {expected}")
    if payload.action in COMMENT_REQUIRED_ACTIONS and not (payload.comment or "").strip():
        raise HTTPException(status_code=400, detail="A reason/comment is required for this action")

    if payload.action == "activate":
        missing = []
        if not agreement.signing_date:
            missing.append("signing date")
        if not agreement.effective_date:
            missing.append("effective date")
        if not agreement.expiry_date:
            missing.append("expiry date")
        if not agreement.internal_champion:
            missing.append("internal Champion")
        if not agreement.partner_liaison:
            missing.append("partner liaison")
        if not agreement.deliverables:
            missing.append("at least one M&E deliverable target")
        has_signed_document = any(doc.document_type == "signed" and doc.is_official for doc in agreement.documents)
        if not has_signed_document:
            missing.append("official signed agreement document")
        if missing:
            raise HTTPException(status_code=400, detail=f"Activation requires: {', '.join(missing)}")
        if agreement.expiry_date <= agreement.effective_date:
            raise HTTPException(status_code=400, detail="Expiry date must be after the effective date")

    from_stage = agreement.stage
    new_stage, new_status, color, next_action = TRANSITIONS[payload.action]
    agreement.stage = new_stage
    agreement.status = new_status
    agreement.status_color = color
    agreement.next_action = next_action
    now = utc_now()
    if payload.action == "submit":
        agreement.submitted_at = now
        if not agreement.assigned_approver_id:
            approver = db.scalar(
                select(User).where(
                    User.role == "approver",
                    User.is_active.is_(True),
                    User.department == agreement.department,
                ).order_by(User.id)
            ) or db.scalar(select(User).where(User.role == "approver", User.is_active.is_(True)).order_by(User.id))
            if approver:
                agreement.assigned_approver_id = approver.id
        if not agreement.assigned_linkages_id:
            linkages_user = db.scalar(select(User).where(User.role == "linkages", User.is_active.is_(True)).order_by(User.id))
            if linkages_user:
                agreement.assigned_linkages_id = linkages_user.id
    elif payload.action == "send_legal":
        if not agreement.legal_review_started_at:
            agreement.legal_review_started_at = now
        if not agreement.legal_reviewer_id:
            legal_user = db.scalar(select(User).where(User.role == "legal", User.is_active.is_(True)).order_by(User.id))
            if legal_user:
                agreement.legal_reviewer_id = legal_user.id
    elif payload.action == "submit_vc" and not agreement.date_sent_vc:
        agreement.date_sent_vc = date.today()
    elif payload.action == "mark_signed" and not agreement.signing_date:
        agreement.signing_date = date.today()
    elif payload.action == "activate":
        agreement.activated_at = now

    db.add(
        WorkflowEvent(
            agreement_id=agreement.id,
            from_stage=from_stage,
            to_stage=new_stage,
            action=payload.action,
            comment=(payload.comment or "").strip() or None,
            actor_id=user.id,
        )
    )
    audit(db, user, f"workflow_{payload.action}", "agreement", agreement.id, request, old_value=from_stage, new_value=new_stage)
    db.add(
        Notification(
            user_id=agreement.owner_id,
            title="Agreement status updated",
            message=f"{agreement.reference_number} moved to {new_stage.replace('_', ' ')}.",
            level=color,
            agreement_id=agreement.id,
        )
    )
    notify_roles(
        db,
        _transition_recipient_roles(payload.action),
        "Workflow update",
        f"{agreement.reference_number}: {payload.action.replace('_', ' ')} by {user.full_name}.",
        agreement.id,
        color,
    )
    db.commit()
    return get_agreement_detail(db, user, agreement.id)
