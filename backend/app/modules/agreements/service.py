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

from pathlib import Path
from fastapi import HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload
from uuid import uuid4
from dateutil.relativedelta import relativedelta

from ...access import (
    apply_agreement_scope,
    ensure_can_edit_agreement,
    ensure_can_view_agreement,
    can_create_comment,
)
from ...deps import audit
from ...core.config import settings
from .models import Agreement, AgreementVersion, Comment, ProgressUpdate
from app.modules.partners.models import Partner
from app.modules.users.models import User
from app.modules.workflows.models import WorkflowEvent
from app.modules.templates import service as template_service
from app.modules.templates.models import Template
from .schemas import AgreementCreate, AgreementDetailOut, AgreementUpdate, CommentCreate, CommentUpdate, ProgressUpdateCreate
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
    "upload_initial_draft",
    "available_actions",
    "create_comment",
    "list_comments",
    "update_comment",
    "create_progress_update",
    "list_progress_updates",
]

LOAD_OPTIONS = (
    selectinload(Agreement.partner),
    selectinload(Agreement.researcher),
    selectinload(Agreement.versions).selectinload(AgreementVersion.uploaded_by),
    selectinload(Agreement.progress_updates),
    selectinload(Agreement.workflow_events).selectinload(WorkflowEvent.actor),
)

RESEARCHER_EDIT_FIELDS = {"title", "department", "start_date", "end_date"}

# Status transition graph — REBUILD_BRIEF.md Section 2.4. Only the
# user-triggered edges are exposed via TransitionRequest; the two
# The researcher submission creates draft_generated and notifies Linkages.
# Linkages' Phase 2 draft upload will transition draft_generated to
# pending_legal_review. The fully_executed -> expired edge belongs to the
# daily expiry job and is not reachable through this table.
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
        # The agreement's own Researcher is notified explicitly at the final
        # upload because notify_roles cannot scope a role to one agreement.
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
        selectinload(Agreement.researcher),
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
    # Researcher self-initiates (REBUILD_BRIEF.md Section 2.1 / 5.3) — no
    # code path lets another role create an agreement on a Researcher's behalf.
    if user.role != "researcher":
        raise HTTPException(status_code=403, detail="Only Researchers can create collaboration requests")
    partner = db.get(Partner, payload.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after the start date")

    template = db.scalar(
        select(Template).where(
            Template.document_type == payload.document_type,
            Template.is_active.is_(True),
        )
    )
    if not template:
        raise HTTPException(status_code=400, detail=f"No active .docx template exists for {payload.document_type}")

    definitions = template_service.list_field_definitions(db)
    known_fields = {item.field_name for item in definitions}
    unknown_fields = sorted(set(payload.field_values) - known_fields)
    if unknown_fields:
        raise HTTPException(status_code=400, detail=f"Unknown form fields: {', '.join(unknown_fields)}")
    values = {key: str(value) for key, value in payload.field_values.items() if value is not None}
    values.update(
        {
            "partner_name": partner.name,
            "agreement_title": payload.title,
            "department": payload.department,
            "start_date": payload.start_date.isoformat(),
            "end_date": payload.end_date.isoformat(),
            "researcher_name": user.full_name,
        }
    )
    missing = sorted(item.field_name for item in definitions if item.required and not str(values.get(item.field_name, "")).strip())
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required form fields: {', '.join(missing)}")
    summary = template_service.template_response_data(db, template)
    if summary["missing_required"] or summary["unknown_tokens"]:
        raise HTTPException(status_code=400, detail="The active template is not valid for the configured form fields")
    try:
        generated_content = template_service.generate_document(template, values)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    agreement = Agreement(
        title=payload.title,
        department=payload.department,
        partner_id=payload.partner_id,
        researcher_id=user.id,
        status="draft_generated",
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(agreement)
    db.flush()
    generated_name = f"generated-intake/{uuid4().hex}.docx"
    generated_path = settings.upload_path / generated_name
    generated_path.parent.mkdir(parents=True, exist_ok=True)
    generated_path.write_bytes(generated_content)
    add_agreement_version(db, agreement, file=generated_name, uploaded_by=user)
    audit(db, user, "create_agreement", "agreement", agreement.id, request, new_value=agreement.title)
    notify_roles(db, {"linkages"}, "Researcher intake ready for Linkages", f"{agreement.title} was submitted by {user.full_name}.", agreement.id)
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
    if user.role == "researcher":
        disallowed = set(changes) - RESEARCHER_EDIT_FIELDS
        if disallowed:
            raise HTTPException(status_code=403, detail=f"Researchers cannot update: {', '.join(sorted(disallowed))}")

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
    if payload.action == "mark_fully_executed":
        raise HTTPException(status_code=409, detail="Upload the final signed scan to complete execution")
    if payload.action == "resubmit_for_verification":
        raise HTTPException(status_code=409, detail="Upload the corrected agreement draft to resubmit for verification")

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


def upload_initial_draft(
    db: Session,
    user: User,
    agreement_id: int,
    content: bytes,
    original_name: str | None,
    request: Request,
) -> AgreementDetailOut:
    """Store the Linkages-prepared legal draft and route it to Legal.

    The Researcher-generated intake stays in the agreement record; this is
    the first AgreementVersion that Legal is expected to review.
    """
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)
    if user.role != "linkages":
        raise HTTPException(status_code=403, detail="Only Linkages can upload the legal agreement draft")
    if agreement.status not in {"draft_generated", "returned_for_corrections", "awaiting_signatures"}:
        raise HTTPException(status_code=409, detail="This agreement is locked or is not ready for a Linkages upload")
    if not content:
        raise HTTPException(status_code=400, detail="The agreement draft file is required")

    suffix = (Path(original_name or "agreement-draft.docx").suffix or ".docx").lower()
    if suffix != ".docx":
        raise HTTPException(status_code=400, detail="The legal agreement draft must be a .docx file")
    stored_name = f"agreement-versions/{uuid4().hex}{suffix}"
    target = settings.upload_path / stored_name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

    from_status = agreement.status
    is_final = from_status == "awaiting_signatures"
    add_agreement_version(db, agreement, file=stored_name, uploaded_by=user, is_final=is_final)
    if from_status == "draft_generated":
        agreement.status = "pending_legal_review"
        notification_roles = {"legal"}
        notification_title = "Draft ready for Legal review"
        notification_message = f"{agreement.title} is ready for Legal review."
    elif from_status == "returned_for_corrections":
        agreement.status = "pending_legal_verification"
        notification_roles = {"legal"}
        notification_title = "Corrected draft ready for Legal verification"
        notification_message = f"{agreement.title} has been resubmitted for Legal verification."
    else:
        agreement.status = "fully_executed"
        # This is the only runtime write site for expiry_alert_date. Renewal
        # semantics remain the explicit Phase 1 TODO and are not inferred here.
        agreement.expiry_alert_date = agreement.end_date - relativedelta(months=6)
        agreement.expiry_notified = False
        notification_roles = {"legal", "me"}
        notification_title = "Agreement fully executed"
        notification_message = f"{agreement.title} has been fully executed."
    db.add(
        WorkflowEvent(
            agreement_id=agreement.id,
            from_stage=from_status,
            to_stage=agreement.status,
            action="upload_final_signed_scan" if is_final else "upload_legal_draft",
            comment="Linkages uploaded the final signed scan." if is_final else "Linkages uploaded the agreement draft.",
            actor_id=user.id,
        )
    )
    audit(db, user, "upload_legal_draft", "agreement", agreement.id, request, old_value=from_status, new_value=agreement.status)
    notify_roles(db, notification_roles, notification_title, notification_message, agreement.id)
    if is_final:
        researcher = db.get(User, agreement.researcher_id)
        if researcher:
            from ..workflows.service import notify_user

            notify_user(db, researcher, notification_title, notification_message, agreement.id)
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def _get_version_with_agreement(db: Session, version_id: int) -> AgreementVersion:
    version = db.scalar(
        select(AgreementVersion)
        .where(AgreementVersion.id == version_id)
        .options(selectinload(AgreementVersion.agreement))
    )
    if not version:
        raise HTTPException(status_code=404, detail="Agreement version not found")
    return version


def list_comments(db: Session, user: User, version_id: int) -> list[Comment]:
    version = _get_version_with_agreement(db, version_id)
    ensure_can_view_agreement(user, version.agreement)
    if user.role not in {"linkages", "legal"}:
        raise HTTPException(status_code=403, detail="Comments are internal to Linkages and Legal")
    return db.scalars(
        select(Comment)
        .where(Comment.version_id == version_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.timestamp)
    ).all()


def create_comment(db: Session, user: User, version_id: int, payload: CommentCreate, request: Request) -> Comment:
    version = _get_version_with_agreement(db, version_id)
    ensure_can_view_agreement(user, version.agreement)
    if user.role != "legal":
        raise HTTPException(status_code=403, detail="Only Legal can create comments")
    if version.is_final or version.agreement.status == "fully_executed":
        raise HTTPException(status_code=409, detail="Fully executed agreements are locked")
    if not can_create_comment(user, version.agreement):
        raise HTTPException(status_code=409, detail="Comments are not allowed at this workflow status")
    comment = Comment(
        version_id=version_id,
        author_id=user.id,
        text=payload.text.strip(),
        section_reference=payload.section_reference,
        status="open",
    )
    db.add(comment)
    db.flush()
    audit(db, user, "create_comment", "comment", comment.id, request, new_value=comment.text)
    db.commit()
    db.refresh(comment)
    return comment


def update_comment(db: Session, user: User, comment_id: int, payload: CommentUpdate, request: Request) -> Comment:
    comment = db.scalar(select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.version).selectinload(AgreementVersion.agreement)))
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    ensure_can_view_agreement(user, comment.version.agreement)
    if user.role != "legal":
        raise HTTPException(status_code=403, detail="Only Legal can update comments")
    if comment.version.is_final or comment.version.agreement.status == "fully_executed":
        raise HTTPException(status_code=409, detail="Fully executed agreements are locked")
    if comment.version.agreement.status not in {"pending_legal_review", "pending_legal_verification"}:
        raise HTTPException(status_code=409, detail="Comments are read-only at this workflow status")
    old_status = comment.status
    comment.status = payload.status
    audit(db, user, "update_comment", "comment", comment.id, request, old_value=old_status, new_value=comment.status)
    db.commit()
    db.refresh(comment)
    return comment


def create_progress_update(db: Session, user: User, agreement_id: int, payload: ProgressUpdateCreate, request: Request) -> ProgressUpdate:
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if user.role != "researcher" or agreement.researcher_id != user.id:
        raise HTTPException(status_code=403, detail="Only the agreement's Researcher can submit progress updates")
    if agreement.status not in {"fully_executed", "expired"}:
        raise HTTPException(status_code=400, detail="Progress updates are allowed only for fully executed or expired agreements")
    update = ProgressUpdate(
        agreement_id=agreement_id,
        quarter=payload.quarter,
        notes=payload.notes.strip(),
        submitted_by_id=user.id,
    )
    db.add(update)
    db.flush()
    audit(db, user, "create_progress_update", "progress_update", update.id, request, new_value=update.quarter)
    db.commit()
    db.refresh(update)
    return update


def list_progress_updates(db: Session, user: User, agreement_id: int | None = None) -> list[ProgressUpdate]:
    if user.role != "me":
        raise HTTPException(status_code=403, detail="Only M&E can list all progress updates")
    statement = select(ProgressUpdate).options(selectinload(ProgressUpdate.submitted_by)).order_by(ProgressUpdate.created_at.desc())
    if agreement_id is not None:
        statement = statement.where(ProgressUpdate.agreement_id == agreement_id)
    return db.scalars(statement).all()


def get_agreement_for_version(db: Session, user: User, agreement_id: int, version_id: int) -> AgreementVersion:
    version = db.scalar(
        select(AgreementVersion)
        .join(Agreement, Agreement.id == AgreementVersion.agreement_id)
        .where(AgreementVersion.id == version_id, AgreementVersion.agreement_id == agreement_id)
    )
    if not version:
        raise HTTPException(status_code=404, detail="Agreement version not found")
    ensure_can_view_agreement(user, version.agreement)
    return version
