from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Agreement, MEReportSchedule, Notification, User

# Spec swimlane (Figure 3/4): Champion -> Linkages -> Legal -> DVC RPE -> VC -> signing.
# The former department_approval stage was removed per Directorate validation.
STAGE_ORDER = [
    "initiation",
    "linkages_review",
    "legal_review",
    "dvc_signoff",
    "vc_submission",
    "signing",
    "active",
    "renewal_closure",
    "archived",
]

# action: (new_stage, new_status, color, next_action)
TRANSITIONS = {
    "submit": ("linkages_review", "pending_linkages", "yellow", "Linkages completeness and strategic-fit review"),
    "return_correction": ("initiation", "correction_required", "yellow", "Champion to correct and resubmit"),
    "send_legal": ("legal_review", "in_legal_review", "green", "Legal Office to review draft (21-day SLA)"),
    "approve_legal": ("dvc_signoff", "pending_dvc_signoff", "green", "DVC RPE to endorse the legally approved package"),
    "dvc_sign": ("vc_submission", "ready_for_vc_package", "green", "Linkages to assemble and submit the VC package"),
    "dvc_return": ("legal_review", "returned_by_dvc", "yellow", "Address DVC RPE remarks and re-approve"),
    "submit_vc": ("signing", "awaiting_signature", "yellow", "Track VC and partner signatures"),
    "mark_signed": ("signing", "fully_signed", "green", "Complete activation information"),
    "activate": ("active", "active", "green", "Update M&E deliverables and evidence"),
    "renew": ("renewal_closure", "renewal_review", "orange", "Complete renewal decision"),
    "close": ("renewal_closure", "closed", "green", "Archive completed agreement"),
    "archive": ("archived", "archived", "green", "Read-only record"),
    "reject": ("renewal_closure", "rejected", "red", "No further action"),
}

ALLOWED_BY_STAGE = {
    "submit": {"initiation"},
    "return_correction": {"linkages_review", "legal_review"},
    "send_legal": {"linkages_review"},
    "approve_legal": {"legal_review"},
    "dvc_sign": {"dvc_signoff"},
    "dvc_return": {"dvc_signoff"},
    "submit_vc": {"vc_submission"},
    "mark_signed": {"signing"},
    "activate": {"signing"},
    "renew": {"active"},
    "close": {"active", "renewal_closure"},
    "archive": {"renewal_closure"},
    "reject": {"linkages_review", "legal_review", "dvc_signoff", "vc_submission", "signing"},
}

ALLOWED_BY_ROLE = {
    "submit": {"champion", "linkages", "admin"},
    "return_correction": {"linkages", "legal", "admin"},
    "send_legal": {"linkages", "admin"},
    "approve_legal": {"legal", "admin"},
    "dvc_sign": {"dvc", "admin"},
    "dvc_return": {"dvc", "admin"},
    "submit_vc": {"linkages", "admin"},
    "mark_signed": {"linkages", "vc_office", "admin"},
    "activate": {"linkages", "admin"},
    "renew": {"linkages", "executive", "admin"},
    "close": {"linkages", "executive", "admin"},
    "archive": {"linkages", "admin"},
    "reject": {"linkages", "legal", "dvc", "executive", "admin"},
}


def create_reference(db: Session, agreement_type: str) -> str:
    year = datetime.utcnow().year
    count = db.scalar(select(func.count(Agreement.id)).where(Agreement.agreement_type == agreement_type)) or 0
    return f"JKUAT-{agreement_type.upper()}-{year}-{count + 1:04d}"


def notify_roles(db: Session, roles: set[str], title: str, message: str, agreement_id: int | None = None, level: str = "info") -> None:
    users = db.scalars(select(User).where(User.role.in_(roles), User.is_active.is_(True))).all()
    for user in users:
        db.add(Notification(user_id=user.id, title=title, message=message, level=level, agreement_id=agreement_id))


def notify_user(db: Session, user_id: int, title: str, message: str, agreement_id: int | None = None, level: str = "info") -> None:
    db.add(Notification(user_id=user_id, title=title, message=message, level=level, agreement_id=agreement_id))


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


def generate_me_schedules(db: Session, agreement: Agreement) -> int:
    """BR-007 / FR-021: create a six-month reporting schedule on activation.

    Periods run from the effective date to the expiry date. Existing schedules
    are preserved (re-activation after renewal only appends missing periods).
    """
    if not agreement.effective_date or not agreement.expiry_date:
        return 0
    existing = {s.due_date for s in db.scalars(select(MEReportSchedule).where(MEReportSchedule.agreement_id == agreement.id)).all()}
    created = 0
    due = agreement.effective_date
    index = 0
    while index < 20:  # safety cap
        index += 1
        month = due.month + 6
        year = due.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(due.day, 28)
        due = date(year, month, day)
        if due > agreement.expiry_date:
            break
        if due not in existing:
            db.add(MEReportSchedule(
                agreement_id=agreement.id,
                period_label=f"Six-month report {index} ({due.strftime('%b %Y')})",
                due_date=due,
            ))
            created += 1
    return created


def refresh_me_alerts(db: Session) -> int:
    """FR-025: notify the JKUAT Champion when a six-month report is due or overdue.

    Alerts fire from 30 days before the due date and repeat at most weekly.
    """
    now = datetime.utcnow()
    horizon = date.today() + timedelta(days=30)
    schedules = db.scalars(
        select(MEReportSchedule).where(
            MEReportSchedule.status.in_(["pending", "returned"]),
            MEReportSchedule.due_date <= horizon,
        )
    ).all()
    sent = 0
    for schedule in schedules:
        if schedule.alerted_at and (now - schedule.alerted_at) < timedelta(days=7):
            continue
        agreement = db.get(Agreement, schedule.agreement_id)
        if not agreement or agreement.stage != "active":
            continue
        overdue = schedule.due_date < date.today()
        title = "M&E report overdue" if overdue else "M&E report due soon"
        level = "red" if overdue else "orange"
        message = (
            f"{agreement.reference_number}: {schedule.period_label} "
            f"{'was due ' + schedule.due_date.isoformat() if overdue else 'is due by ' + schedule.due_date.isoformat()}. "
            "Please submit the activity report."
        )
        notify_user(db, agreement.owner_id, title, message, agreement.id, level)
        notify_roles(db, {"me", "linkages"}, title, message, agreement.id, level)
        schedule.alerted_at = now
        sent += 1
    return sent
