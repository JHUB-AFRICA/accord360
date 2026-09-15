from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.agreements.models import Agreement
from app.modules.users.models import User
from app.modules.workflows.models import Notification
from app.modules.workflows.models import Correction
from app.access import apply_agreement_scope, ensure_can_view_agreement
from app.modules.workflows.schemas import CorrectionResolution, CorrectionResponse
from app.deps import audit
from app.utils.email_service import send_notification_email
from ...timeutils import utc_now

STAGE_ORDER = [
    "initiation",
    "department_approval",
    "linkages_review",
    "legal_review",
    "dvc_approval",
    "vc_submission",
    "validation_signing",
    "active",
    "renewal_closure",
    "archived",
]

TRANSITIONS = {
    "submit": ("department_approval", "pending_department", "yellow", "Department/faculty approval required"),
    "approve_department": ("linkages_review", "pending_linkages", "yellow", "Linkages completeness and strategic-fit review"),
    "return_correction": ("initiation", "correction_required", "yellow", "Champion to correct and resubmit"),
    "approve_linkages": ("linkages_review", "linkages_approved", "green", "Route the approved request to Legal Office"),
    "send_legal": ("legal_review", "in_legal_review", "green", "Legal Office review in progress"),
    "approve_legal": ("dvc_approval", "legal_approved", "green", "DVC RPE endorsement required"),
    "approve_dvc": ("vc_submission", "dvc_approved", "green", "Linkages to submit the endorsed package to VC Office"),
    "return_dvc": ("legal_review", "dvc_returned", "yellow", "Address DVC RPE remarks and resubmit for endorsement"),
    "submit_vc": ("validation_signing", "awaiting_vc_signature", "yellow", "VC Office to record signature milestone"),
    "record_vc_signature": ("validation_signing", "awaiting_partner_signature", "yellow", "Await partner signature and complete execution"),
    "mark_signed": ("validation_signing", "fully_signed", "green", "Complete activation information"),
    "activate": ("active", "active", "green", "Update six-month M&E reports, deliverables and evidence"),
    "renew": ("renewal_closure", "renewal_review", "orange", "Complete renewal decision"),
    "close": ("renewal_closure", "closed", "green", "Archive completed agreement"),
    "archive": ("archived", "archived", "green", "Read-only institutional record"),
    "reject": ("renewal_closure", "rejected", "red", "No further action"),
}

ALLOWED_BY_STAGE = {
    "submit": {"initiation"},
    "approve_department": {"department_approval"},
    "return_correction": {"department_approval", "linkages_review", "legal_review"},
    "approve_linkages": {"linkages_review"},
    "send_legal": {"linkages_review"},
    "approve_legal": {"legal_review"},
    "approve_dvc": {"dvc_approval"},
    "return_dvc": {"dvc_approval"},
    "submit_vc": {"vc_submission"},
    "record_vc_signature": {"validation_signing"},
    "mark_signed": {"validation_signing"},
    "activate": {"validation_signing"},
    "renew": {"active"},
    "close": {"active", "renewal_closure"},
    "archive": {"renewal_closure"},
    "reject": {"department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"},
}

# Business approvals are intentionally separated from technical administration.
ALLOWED_BY_ROLE = {
    "submit": {"researcher", "linkages", "director_linkages"},
    "approve_department": {"approver"},
    "return_correction": {"approver", "linkages", "director_linkages", "legal"},
    "approve_linkages": {"linkages", "director_linkages"},
    "send_legal": {"linkages", "director_linkages"},
    "approve_legal": {"legal"},
    "approve_dvc": {"dvc"},
    "return_dvc": {"dvc"},
    "submit_vc": {"linkages", "director_linkages"},
    "record_vc_signature": {"vc_office"},
    "mark_signed": {"vc_office", "linkages", "director_linkages"},
    "activate": {"linkages", "director_linkages"},
    "renew": {"linkages", "director_linkages"},
    "close": {"linkages", "director_linkages"},
    "archive": {"linkages", "director_linkages"},
    "reject": {"approver", "linkages", "director_linkages", "legal", "dvc"},
}

REQUIRED_STATUS_BY_ACTION = {
    "submit": {"draft", "correction_required"},
    "approve_department": {"pending_department"},
    "approve_linkages": {"pending_linkages"},
    "send_legal": {"linkages_approved"},
    "approve_legal": {"in_legal_review", "pending_legal", "legal_stalled", "dvc_returned"},
    "approve_dvc": {"legal_approved"},
    "return_dvc": {"legal_approved"},
    "submit_vc": {"dvc_approved"},
    "record_vc_signature": {"awaiting_vc_signature"},
    "mark_signed": {"awaiting_vc_signature", "awaiting_partner_signature"},
    "activate": {"fully_signed"},
    "archive": {"closed"},
}

COMMENT_REQUIRED_ACTIONS = {"return_correction", "return_dvc", "reject", "close"}


def _correction_requested_by_role(actor: User, return_action: str) -> bool:
    if actor.role == "admin":
        return True
    if return_action == "return_dvc":
        return actor.role == "dvc"
    return actor.role in {"approver", "linkages", "director_linkages", "legal"}


def create_correction(
    db: Session,
    agreement: Agreement,
    event: WorkflowEvent,
    actor: User,
    *,
    exact_item: str | None = None,
    requested_change: str | None = None,
    details: str | None = None,
) -> Correction:
    comment = (event.comment or "").strip()
    parsed: dict[str, str] = {}
    for line in comment.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            parsed[key.strip().lower().replace(" ", "_")] = value.strip()
    correction = Correction(
        agreement_id=agreement.id,
        workflow_event_id=event.id,
        return_action=event.action,
        exact_item=(exact_item or parsed.get("exact_item") or "Workflow return").strip(),
        requested_change=(requested_change or parsed.get("requested_change") or comment).strip(),
        details=(details or parsed.get("additional_context") or None),
        requested_by_id=actor.id,
        assigned_to_id=agreement.owner_id if event.action == "return_correction" else agreement.legal_reviewer_id,
    )
    db.add(correction)
    return correction


def _correction_query(user: User):
    stmt = (
        select(Correction)
        .join(Correction.agreement)
        .options(
            selectinload(Correction.agreement).selectinload(Agreement.partner),
            selectinload(Correction.workflow_event),
            selectinload(Correction.requested_by),
            selectinload(Correction.assigned_to),
            selectinload(Correction.responded_by),
            selectinload(Correction.resolved_by),
        )
    )
    return apply_agreement_scope(stmt, user)


def list_corrections(db: Session, user: User) -> list[Correction]:
    return db.scalars(_correction_query(user).order_by(Correction.created_at.desc())).all()


def get_correction(db: Session, user: User, correction_id: int) -> Correction:
    correction = db.scalar(_correction_query(user).where(Correction.id == correction_id))
    if not correction:
        raise LookupError("Correction not found")
    ensure_can_view_agreement(user, correction.agreement)
    return correction


def respond_to_correction(db: Session, user: User, correction_id: int, payload: CorrectionResponse, request) -> Correction:
    correction = get_correction(db, user, correction_id)
    if correction.status != "pending":
        raise ValueError("This correction is no longer awaiting a response")
    if correction.return_action == "return_correction":
        if user.role not in {"researcher", "linkages", "director_linkages"}:
            raise PermissionError("Only the assigned Champion or Linkages officer can respond")
        transition_action = "submit"
    else:
        if user.role != "legal":
            raise PermissionError("Only Legal can respond to a DVC return")
        transition_action = "approve_legal"

    from app.modules.agreements.service import transition_agreement
    from app.modules.workflows.schemas import TransitionRequest

    transition_agreement(
        db,
        user,
        correction.agreement_id,
        TransitionRequest(action=transition_action, comment=payload.response_text),
        request,
    )
    correction.status = "responded"
    correction.response_text = payload.response_text.strip()
    correction.responded_by_id = user.id
    correction.responded_at = utc_now()
    db.commit()
    return get_correction(db, user, correction.id)


def resolve_correction(db: Session, user: User, correction_id: int, payload: CorrectionResolution, request) -> Correction:
    correction = get_correction(db, user, correction_id)
    if correction.status != "responded":
        raise ValueError("A correction can only be resolved after a response")
    if not _correction_requested_by_role(correction.requested_by, correction.return_action):
        raise ValueError("The correction requester is not eligible to resolve this record")
    if user.role != "admin" and user.role != correction.requested_by.role:
        if not ({user.role, correction.requested_by.role} <= {"linkages", "director_linkages"}):
            raise PermissionError("Only the requesting review function can resolve this correction")
    correction.status = "resolved"
    correction.resolution_notes = payload.resolution_notes.strip()
    correction.resolved_by_id = user.id
    correction.resolved_at = utc_now()
    audit(db, user, "resolve_correction", "correction", correction.id, request, new_value=correction.resolution_notes)
    db.commit()
    return get_correction(db, user, correction.id)


def create_reference(agreement_type: str, agreement_id: int) -> str:
    """Build a unique, stable reference using the persisted database ID."""
    year = utc_now().year
    normalized_type = "".join(ch for ch in agreement_type.upper() if ch.isalnum()) or "AGR"
    return f"JKUAT-{normalized_type}-{year}-{agreement_id:04d}"


def notify_user(
    db: Session,
    user: User,
    title: str,
    message: str,
    agreement_id: int | None = None,
    level: str = "info",
) -> None:
    db.add(Notification(user_id=user.id, title=title, message=message, level=level, agreement_id=agreement_id))
    send_notification_email(user.email, user.full_name, title, message)


def notify_roles(db: Session, roles: set[str], title: str, message: str, agreement_id: int | None = None, level: str = "info") -> None:
    users = db.scalars(select(User).where(User.role.in_(roles), User.is_active.is_(True))).all()
    for user in users:
        notify_user(db, user, title, message, agreement_id, level)


def refresh_risk_status(agreement: Agreement) -> None:
    """Apply legal SLA, expiry and M&E dormancy rules in priority order."""
    if agreement.stage == "archived" or agreement.status in {"archived", "closed", "rejected"}:
        return

    now = utc_now()
    today = date.today()

    if agreement.stage == "legal_review" and agreement.legal_review_started_at:
        if now - agreement.legal_review_started_at > timedelta(days=21):
            agreement.status_color = "red"
            agreement.status = "legal_stalled"
            agreement.next_action = "Legal Office to resolve the blocker or escalate"
            return

    if agreement.stage == "active" and agreement.expiry_date:
        days = (agreement.expiry_date - today).days
        if days <= 90:
            agreement.status_color = "red"
            agreement.status = "expiry_critical"
            agreement.next_action = "Linkages to escalate the renewal decision"
            return

    if agreement.stage == "active":
        activity_dates = [item.last_updated_at for item in getattr(agreement, "deliverables", []) if item.last_updated_at]
        baseline = max(activity_dates, default=agreement.activated_at)
        if baseline and now - baseline >= timedelta(days=180):
            agreement.status_color = "red"
            agreement.status = "dormant"
            agreement.next_action = "Champion to submit M&E actuals and supporting evidence"
            return

        if agreement.expiry_date:
            days = (agreement.expiry_date - today).days
            if days <= 183:
                agreement.status_color = "orange"
                agreement.status = "expiry_warning"
                agreement.next_action = "Review renewal, closure or extension"
                return

        agreement.status_color = "green"
        agreement.status = "active"
        agreement.next_action = agreement.next_action or "Submit the next six-month M&E report"
