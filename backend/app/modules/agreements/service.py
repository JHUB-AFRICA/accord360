"""Agreement domain service.

Holds the business logic for the agreement lifecycle: listing/scoping,
creation, detail retrieval, updates and status transitions. Routers in this
module should only parse the request, call one of these functions, and
return/raise based on the result.

Per REBUILD_BRIEF.md Section 2, Phase 1 only needs the Agreement status
state machine itself (Section 2.4's transition graph) working end to end
with role gating — comment CRUD, version-upload endpoints and the document
generation engine are Phase 2/3 work and are intentionally not built here.
"""

from __future__ import annotations

from fastapi import HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ...access import (
    apply_agreement_scope,
    ensure_can_edit_agreement,
    ensure_can_view_agreement,
)
from ...deps import audit
from .models import Agreement, AgreementVersion
from app.modules.partners.models import Partner
from app.modules.users.models import User
from app.modules.workflows.models import WorkflowEvent
from .schemas import AgreementCreate, AgreementDetailOut, AgreementUpdate
from app.modules.workflows.schemas import TransitionRequest
from ..workflows.service import notify_roles

__all__ = [
    "notify_roles",
    "LOAD_OPTIONS",
    "scoped_query",
    "list_agreements",
    "create_agreement",
    "get_agreement_detail",
    "update_agreement",
    "transition_agreement",
    "add_agreement_version",
    "available_actions",
]

LOAD_OPTIONS = (
    selectinload(Agreement.partner),
    selectinload(Agreement.champion),
    selectinload(Agreement.versions).selectinload(AgreementVersion.uploaded_by),
    selectinload(Agreement.progress_updates),
    selectinload(Agreement.workflow_events).selectinload(WorkflowEvent.actor),
)

CHAMPION_EDIT_FIELDS = {"title", "department", "start_date", "end_date"}

# Status transition graph — REBUILD_BRIEF.md Section 2.4. Only the
# user-triggered edges are exposed via TransitionRequest; the two
# system/automatic edges (draft_generated -> pending_legal_review on draft
# generation, and fully_executed -> expired on the daily expiry job) belong
# to Phase 2/3 and are not reachable through this table.
# (from_status, action) -> (to_status, allowed_roles)
TRANSITIONS: dict[tuple[str, str], tuple[str, set[str]]] = {
    ("pending_legal_review", "request_corrections"): ("returned_for_corrections", {"legal"}),
    # inferred edge, confirm with Linkages Office (Section 2.4a)
    ("pending_legal_review", "approve"): ("approved_for_signing", {"legal"}),
    ("returned_for_corrections", "resubmit_for_verification"): ("pending_legal_verification", {"linkages"}),
    ("pending_legal_verification", "approve"): ("approved_for_signing", {"legal"}),
    ("pending_legal_verification", "request_corrections"): ("returned_for_corrections", {"legal"}),
    ("approved_for_signing", "start_signing"): ("awaiting_signatures", {"linkages"}),
    ("awaiting_signatures", "mark_fully_executed"): ("fully_executed", {"linkages"}),
    # TODO(spec): confirm exact renewal semantics with Linkages Office
    # (Section 2.5) — minimum implemented default: expired -> approved_for_signing.
    ("expired", "renew"): ("approved_for_signing", {"me"}),
    ("expired", "archive"): ("archived", {"me"}),
}


def _transition_recipient_roles(to_status: str) -> set[str]:
    """Notification recipients for a status change (kept minimal; the full
    7-trigger notification table is Phase 3, Section 4.6).
    """
    mapping = {
        "returned_for_corrections": {"linkages"},
        "pending_legal_verification": {"legal"},
        "approved_for_signing": {"linkages"},
        "awaiting_signatures": {"linkages"},
        "fully_executed": {"legal", "me"},
        "expired": {"me"},
        "archived": {"me"},
    }
    return mapping.get(to_status, set())


def available_actions(user: User, agreement: Agreement) -> list[str]:
    """Actions this user may currently perform, derived from TRANSITIONS —
    single source of truth for Section 5.2's `available_actions` field.
    """
    return [
        action
        for (from_status, action), (_, roles) in TRANSITIONS.items()
        if from_status == agreement.status and user.role in roles
    ]


def scoped_query(user: User):
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.champion),
    )
    return apply_agreement_scope(stmt, user)


def list_agreements(
    db: Session,
    user: User,
    *,
    search: str | None,
    status_filter: str | None,
    department: str | None,
):
    stmt = scoped_query(user)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Agreement.title.ilike(pattern),
                Agreement.partner.has(Partner.name.ilike(pattern)),
            )
        )
    if status_filter:
        stmt = stmt.where(Agreement.status == status_filter)
    if department:
        stmt = stmt.where(Agreement.department == department)
    return db.scalars(stmt.order_by(Agreement.updated_at.desc())).all()


def create_agreement(db: Session, user: User, payload: AgreementCreate, request: Request) -> AgreementDetailOut:
    # Champion self-initiates (REBUILD_BRIEF.md Section 2.1 / 5.3) — no
    # code path lets another role create an agreement on a Champion's behalf.
    if user.role != "champion":
        raise HTTPException(status_code=403, detail="Only Champions can create collaboration requests")
    partner = db.get(Partner, payload.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after the start date")

    agreement = Agreement(
        title=payload.title,
        department=payload.department,
        partner_id=payload.partner_id,
        champion_id=user.id,
        status="draft_generated",
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(agreement)
    db.flush()
    audit(db, user, "create_agreement", "agreement", agreement.id, request, new_value=agreement.title)
    notify_roles(db, {"linkages"}, "New collaboration request", f"{agreement.title} was created by {user.full_name}.", agreement.id)
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def get_agreement_detail(db: Session, user: User, agreement_id: int) -> AgreementDetailOut:
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id).options(*LOAD_OPTIONS))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    # Conceal out-of-scope records on direct reads. Mutating endpoints retain
    # their explicit 403 responses so callers can distinguish read-only access
    # from an authorization failure when attempting a change.
    from ...access import can_view_agreement

    if not can_view_agreement(user, agreement):
        raise HTTPException(status_code=404, detail="Agreement not found")
    result = AgreementDetailOut.model_validate(agreement)
    result.available_actions = available_actions(user, agreement)
    return result


def update_agreement(db: Session, user: User, agreement_id: int, payload: AgreementUpdate, request: Request) -> AgreementDetailOut:
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_edit_agreement(user, agreement)

    changes = payload.model_dump(exclude_unset=True)
    if user.role == "champion":
        disallowed = set(changes) - CHAMPION_EDIT_FIELDS
        if disallowed:
            raise HTTPException(status_code=403, detail=f"Champions cannot update: {', '.join(sorted(disallowed))}")

    start_date = changes.get("start_date", agreement.start_date)
    end_date = changes.get("end_date", agreement.end_date)
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after the start date")

    old_title = agreement.title
    for key, value in changes.items():
        setattr(agreement, key, value)
    audit(db, user, "update_agreement", "agreement", agreement.id, request, old_value=old_title, new_value=agreement.title)
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def transition_agreement(db: Session, user: User, agreement_id: int, payload: TransitionRequest, request: Request) -> AgreementDetailOut:
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)

    key = (agreement.status, payload.action)
    transition = TRANSITIONS.get(key)
    if not transition:
        raise HTTPException(
            status_code=400,
            detail=f"Action '{payload.action}' is not valid while the agreement is '{agreement.status}'",
        )
    to_status, allowed_roles = transition
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role '{user.role}' cannot perform '{payload.action}'")

    from_status = agreement.status
    agreement.status = to_status
    if to_status == "archived":
        agreement.archived = True

    db.add(
        WorkflowEvent(
            agreement_id=agreement.id,
            from_stage=from_status,
            to_stage=to_status,
            action=payload.action,
            comment=(payload.comment or "").strip() or None,
            actor_id=user.id,
        )
    )
    audit(db, user, f"transition_{payload.action}", "agreement", agreement.id, request, old_value=from_status, new_value=to_status)

    champion = db.get(User, agreement.champion_id)
    if champion and champion.id != user.id:
        from ..workflows.service import notify_user

        notify_user(db, champion, "Agreement status updated", f"{agreement.title} moved to {to_status.replace('_', ' ')}.", agreement.id)
    notify_roles(
        db,
        _transition_recipient_roles(to_status),
        "Workflow update",
        f"{agreement.title}: {payload.action.replace('_', ' ')} by {user.full_name}.",
        agreement.id,
    )
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def add_agreement_version(
    db: Session,
    agreement: Agreement,
    *,
    file: str,
    uploaded_by: User,
    is_final: bool = False,
) -> AgreementVersion:
    """Create a new AgreementVersion, enforcing the two Section 2.6 invariants:

    1. At most one AgreementVersion per Agreement has is_final=true.
    2. Once an Agreement has a final version, no further AgreementVersion can
       be created for it.

    This is a data-layer building block for Phase 2/3's re-upload / signing
    endpoints; it is not itself exposed over HTTP in Phase 1.
    """
    existing_final = db.scalar(
        select(AgreementVersion).where(AgreementVersion.agreement_id == agreement.id, AgreementVersion.is_final.is_(True))
    )
    if existing_final is not None:
        raise ValueError("This agreement already has a final version; no further versions can be created")

    version = AgreementVersion(
        agreement_id=agreement.id,
        file=file,
        uploaded_by_id=uploaded_by.id,
        status_at_time=agreement.status,
        is_final=is_final,
    )
    db.add(version)
    db.flush()
    return version
