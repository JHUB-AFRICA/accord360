from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.agreements.models import Agreement
from app.modules.users.models import User
from app.modules.workflows.models import Notification
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


def create_reference(agreement_type: str, agreement_id: int) -> str:
    """Build a unique, stable reference using the persisted database ID."""
    year = utc_now().year
    normalized_type = "".join(ch for ch in agreement_type.upper() if ch.isalnum()) or "AGR"
    return f"JKUAT-{normalized_type}-{year}-{agreement_id:04d}"


def notify_roles(db: Session, roles: set[str], title: str, message: str, agreement_id: int | None = None, level: str = "info") -> None:
    users = db.scalars(select(User).where(User.role.in_(roles), User.is_active.is_(True))).all()
    for user in users:
        db.add(Notification(user_id=user.id, title=title, message=message, level=level, agreement_id=agreement_id))


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
