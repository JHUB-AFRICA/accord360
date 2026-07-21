from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Agreement, Notification, User

STAGE_ORDER = [
    "initiation",
    "department_approval",
    "linkages_review",
    "legal_review",
    "validation_signing",
    "active",
    "renewal_closure",
    "archived",
]

TRANSITIONS = {
    "submit": ("department_approval", "pending_department", "yellow", "Department/faculty approval required"),
    "approve_department": ("linkages_review", "pending_linkages", "yellow", "Linkages completeness and strategic-fit review"),
    "return_correction": ("initiation", "correction_required", "yellow", "Researcher to correct and resubmit"),
    "approve_linkages": ("legal_review", "pending_legal", "green", "Legal reviewer to vet draft"),
    "send_legal": ("legal_review", "in_legal_review", "green", "Legal review in progress"),
    "approve_legal": ("validation_signing", "ready_for_signing", "green", "Send approved draft for signatures"),
    "send_signing": ("validation_signing", "awaiting_signature", "yellow", "Await VC and partner signatures"),
    "mark_signed": ("validation_signing", "fully_signed", "green", "Complete activation information"),
    "activate": ("active", "active", "green", "Update M&E deliverables and evidence"),
    "renew": ("renewal_closure", "renewal_review", "orange", "Complete renewal decision"),
    "close": ("renewal_closure", "closed", "green", "Archive completed agreement"),
    "archive": ("archived", "archived", "green", "Read-only record"),
    "reject": ("renewal_closure", "rejected", "red", "No further action"),
}

ALLOWED_BY_STAGE = {
    "submit": {"initiation"},
    "approve_department": {"department_approval"},
    "return_correction": {"department_approval", "linkages_review", "legal_review"},
    "approve_linkages": {"linkages_review"},
    "send_legal": {"linkages_review"},
    "approve_legal": {"legal_review"},
    "send_signing": {"validation_signing"},
    "mark_signed": {"validation_signing"},
    "activate": {"validation_signing"},
    "renew": {"active"},
    "close": {"active", "renewal_closure"},
    "archive": {"renewal_closure"},
    "reject": {"department_approval", "linkages_review", "legal_review", "validation_signing"},
}

ALLOWED_BY_ROLE = {
    "submit": {"researcher", "admin", "linkages"},
    "approve_department": {"approver", "admin"},
    "return_correction": {"approver", "linkages", "legal", "admin"},
    "approve_linkages": {"linkages", "admin"},
    "send_legal": {"linkages", "admin"},
    "approve_legal": {"legal", "admin"},
    "send_signing": {"linkages", "admin"},
    "mark_signed": {"linkages", "admin"},
    "activate": {"linkages", "admin"},
    "renew": {"linkages", "executive", "admin"},
    "close": {"linkages", "executive", "admin"},
    "archive": {"linkages", "admin"},
    "reject": {"approver", "linkages", "legal", "executive", "admin"},
}


def create_reference(db: Session, agreement_type: str) -> str:
    year = datetime.utcnow().year
    count = db.scalar(select(func.count(Agreement.id)).where(Agreement.agreement_type == agreement_type)) or 0
    return f"JKUAT-{agreement_type.upper()}-{year}-{count + 1:04d}"


def notify_roles(db: Session, roles: set[str], title: str, message: str, agreement_id: int | None = None, level: str = "info") -> None:
    users = db.scalars(select(User).where(User.role.in_(roles), User.is_active.is_(True))).all()
    for user in users:
        db.add(Notification(user_id=user.id, title=title, message=message, level=level, agreement_id=agreement_id))


def refresh_risk_status(agreement: Agreement) -> None:
    today = date.today()
    if agreement.stage == "legal_review" and agreement.legal_review_started_at:
        if datetime.utcnow() - agreement.legal_review_started_at > timedelta(days=21):
            agreement.status_color = "red"
            agreement.status = "legal_stalled"
            agreement.next_action = "Resolve legal review blocker or escalate"
            return
    if agreement.stage == "active" and agreement.expiry_date:
        days = (agreement.expiry_date - today).days
        if days <= 90:
            agreement.status_color = "red"
            agreement.status = "expiry_critical"
            agreement.next_action = "Escalate renewal decision"
        elif days <= 183:
            agreement.status_color = "orange"
            agreement.status = "expiry_warning"
            agreement.next_action = "Review renewal, closure or extension"
        elif agreement.status not in {"dormant", "expiry_critical", "expiry_warning"}:
            agreement.status_color = "green"
            agreement.status = "active"
