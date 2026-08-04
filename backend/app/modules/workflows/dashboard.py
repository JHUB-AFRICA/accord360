from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ...access import apply_agreement_scope
from ...db.session import get_db
from ...deps import get_current_user
from ...models import Agreement, AuditLog, User
from ...services import refresh_risk_status
from ...timeutils import utc_now

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ROLE_WORKSPACES = {
    "researcher": {
        "role_label": "JKUAT Champion",
        "eyebrow": "Champion workspace",
        "title": "My collaboration responsibilities",
        "description": "Initiate requests, respond to workflow feedback, track your agreements and submit implementation evidence.",
        "permission_summary": "You can create and edit your own requests, submit them for review, upload permitted documents and update M&E for your active collaborations.",
        "capabilities": ["Create requests", "Track own agreements", "Respond to corrections", "Submit M&E evidence"],
        "guidance": ["Complete and submit new collaboration requests.", "Respond to departmental, Linkages or Legal feedback.", "Upload supporting drafts and approved evidence.", "Submit six-month activity and deliverable updates."],
        "queue_title": "My required actions",
        "queue_description": "Only collaboration records assigned to you as Champion are shown.",
        "primary_action": {"label": "New collaboration request", "path": "/agreements/new"},
        "show_portfolio_analytics": False,
    },
    "approver": {
        "role_label": "Department / Faculty Approver",
        "eyebrow": "Academic governance",
        "title": "Department approval queue",
        "description": "Review academic fit and departmental support before a collaboration proceeds to Linkages.",
        "permission_summary": "You can view agreements in your department or assigned to you, and approve, return or reject only at the department approval stage.",
        "capabilities": ["Review scoped requests", "Approve department gate", "Return with reasons", "Reject with reasons"],
        "guidance": ["Open each request and verify academic fit.", "Check purpose, partner, department and expected outcomes.", "Approve suitable requests or return them with a clear reason.", "Do not edit Linkages, Legal, DVC or signing decisions."],
        "queue_title": "Requests awaiting department decision",
        "queue_description": "Requests are scoped to your department and explicit assignments.",
        "primary_action": None,
        "show_portfolio_analytics": False,
    },
    "linkages": {
        "role_label": "Linkages Officer",
        "eyebrow": "Operational management",
        "title": "Linkages workflow control centre",
        "description": "Manage request intake, strategic-fit review, routing, signing follow-up, activation and renewal.",
        "permission_summary": "You have operational access to the institutional portfolio but cannot issue Legal or DVC approvals on their behalf.",
        "capabilities": ["Log requests", "Route workflow", "Coordinate signing", "Activate agreements"],
        "guidance": ["Validate completeness and strategic alignment.", "Route approved requests to Legal Office.", "Submit DVC-endorsed packages to VC Office.", "Activate fully signed agreements and coordinate renewals."],
        "queue_title": "Linkages operational queue",
        "queue_description": "Records requiring Linkages routing, escalation, signing follow-up or lifecycle action.",
        "primary_action": {"label": "Log new request", "path": "/agreements/new"},
        "show_portfolio_analytics": True,
    },
    "director_linkages": {
        "role_label": "Director, Linkages",
        "eyebrow": "Directorate oversight",
        "title": "Partnership governance and performance",
        "description": "Oversee the full agreement portfolio, bottlenecks, risk, value, performance and renewal decisions.",
        "permission_summary": "You have operational and strategic portfolio access while Legal, DVC and VC actions remain separated by institutional role.",
        "capabilities": ["Portfolio oversight", "Escalation management", "Signing coordination", "Renewal decisions"],
        "guidance": ["Review bottlenecks and overdue workflow actions.", "Coordinate Legal, DVC and VC Office follow-up.", "Track active partnership value and performance.", "Direct renewal, closure and archival decisions."],
        "queue_title": "Directorate attention queue",
        "queue_description": "High-priority operational, risk and renewal matters across the portfolio.",
        "primary_action": {"label": "Log new request", "path": "/agreements/new"},
        "show_portfolio_analytics": True,
    },
    "legal": {
        "role_label": "Legal Office Reviewer",
        "eyebrow": "Legal workspace",
        "title": "Draft review and legal approval",
        "description": "Review assigned agreement drafts, upload controlled versions, return feedback or issue Legal approval.",
        "permission_summary": "You can act on legal-review records and retain version history; you cannot perform DVC endorsement, VC signing or activation.",
        "capabilities": ["Review drafts", "Upload legal versions", "Return feedback", "Approve legal version"],
        "guidance": ["Review the current draft and supporting records.", "Upload or identify the vetted legal version.", "Return the matter with clear comments when revision is required.", "Approve only when the draft is ready for DVC RPE endorsement."],
        "queue_title": "Legal review queue",
        "queue_description": "Assigned and unassigned matters currently at Legal Office review.",
        "primary_action": None,
        "show_portfolio_analytics": False,
    },
    "dvc": {
        "role_label": "DVC RPE",
        "eyebrow": "Governance endorsement",
        "title": "DVC RPE endorsement queue",
        "description": "Review legally approved collaboration packages before they are released to the Vice Chancellor.",
        "permission_summary": "You can endorse or return only legally approved packages. The system blocks VC submission until your endorsement is recorded.",
        "capabilities": ["Review approved package", "Endorse for VC", "Return with remarks", "View portfolio summary"],
        "guidance": ["Confirm that Legal approval is recorded.", "Review strategic and institutional readiness.", "Endorse the package or return it with remarks.", "Do not modify Legal approval or signing milestones."],
        "queue_title": "Packages awaiting DVC RPE endorsement",
        "queue_description": "Only records that passed Legal Office approval appear as actionable items.",
        "primary_action": None,
        "show_portfolio_analytics": True,
    },
    "vc_office": {
        "role_label": "VC Office",
        "eyebrow": "Executive signing",
        "title": "VC signing and execution desk",
        "description": "Receive complete packages, track VC and partner signatures, and record final execution milestones.",
        "permission_summary": "You can update signing dates, upload signed documents and record signature milestones; earlier approvals remain read-only.",
        "capabilities": ["Receive VC package", "Track VC signature", "Track partner signature", "Upload signed document"],
        "guidance": ["Confirm the package has Legal approval and DVC endorsement.", "Record VC signature progress and dates.", "Track the partner signature and ceremony details.", "Mark the agreement fully signed when execution is complete."],
        "queue_title": "Signing packages requiring action",
        "queue_description": "DVC-endorsed packages and agreements currently awaiting signatures.",
        "primary_action": None,
        "show_portfolio_analytics": False,
    },
    "me": {
        "role_label": "M&E Officer",
        "eyebrow": "Implementation accountability",
        "title": "Monitoring and evaluation workspace",
        "description": "Track six-month reports, deliverable targets, actual outputs, evidence, value and dormancy risk.",
        "permission_summary": "You can update M&E data for active collaborations and propose value records; workflow approvals and legal documents remain read-only.",
        "capabilities": ["Update deliverables", "Attach evidence", "Track dormancy", "Record partnership value"],
        "guidance": ["Review active agreements and reporting periods.", "Validate target-versus-actual deliverables.", "Follow up overdue or dormant collaborations.", "Ensure value and evidence records are complete."],
        "queue_title": "M&E follow-up queue",
        "queue_description": "Active agreements with reporting, dormancy, expiry or data-quality attention.",
        "primary_action": None,
        "show_portfolio_analytics": True,
    },
    "executive": {
        "role_label": "Executive Viewer",
        "eyebrow": "Executive intelligence",
        "title": "Institutional partnership performance",
        "description": "View portfolio health, pipeline, risk, value and implementation performance without changing operational records.",
        "permission_summary": "You have read-only access to executive dashboards, authorized agreement records and reports.",
        "capabilities": ["View executive KPIs", "Review portfolio risk", "Inspect score and value", "Export reports"],
        "guidance": ["Monitor active partnership and pipeline trends.", "Review dormant, stalled and expiry-risk agreements.", "Inspect financial and resource value by currency.", "Use drill-down records and reports for management action."],
        "queue_title": "Portfolio risks requiring management attention",
        "queue_description": "Read-only view of red and orange portfolio matters.",
        "primary_action": None,
        "show_portfolio_analytics": True,
    },
    "admin": {
        "role_label": "System Administrator",
        "eyebrow": "Technical administration",
        "title": "Access and system administration",
        "description": "Manage accounts, roles and technical configuration while preserving separation of business approval duties.",
        "permission_summary": "You can administer users, settings and audit controls. Agreement approvals remain assigned to business roles and cannot be forged by administrators.",
        "capabilities": ["Manage users", "Assign roles", "Review audit logs", "Configure system"],
        "guidance": ["Provision and deactivate user accounts.", "Assign least-privilege institutional roles.", "Review system and access audit events.", "Maintain configuration without altering signed business records."],
        "queue_title": "Recent records for administrative visibility",
        "queue_description": "Read-only operational context; use Users, Settings and Audit for administration.",
        "primary_action": None,
        "show_portfolio_analytics": True,
    },
    "auditor": {
        "role_label": "Auditor / Read-only Reviewer",
        "eyebrow": "Compliance assurance",
        "title": "Audit and records review",
        "description": "Inspect authorized agreement records, workflow history, reports and audit events without editing data.",
        "permission_summary": "Your access is read-only and intended for compliance, traceability and records assurance.",
        "capabilities": ["Review records", "Inspect workflow history", "View audit trail", "Export compliance reports"],
        "guidance": ["Trace material actions to the responsible user.", "Review document, workflow and status history.", "Confirm role separation and approval sequence.", "Export scoped evidence for formal review."],
        "queue_title": "Recently changed records",
        "queue_description": "Read-only list supporting audit sampling and traceability.",
        "primary_action": None,
        "show_portfolio_analytics": False,
    },
}


def _shift_month(month_start: date, months: int) -> date:
    index = month_start.year * 12 + (month_start.month - 1) + months
    return date(index // 12, index % 12 + 1, 1)


def _load_scoped_agreements(db: Session, user: User) -> list[Agreement]:
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.deliverables),
        selectinload(Agreement.values),
    )
    agreements = list(db.scalars(apply_agreement_scope(stmt, user)).all())
    for item in agreements:
        refresh_risk_status(item)
    db.commit()
    return agreements


def _is_queue_item(agreement: Agreement, user: User) -> bool:
    role = user.role
    if role == "researcher":
        return agreement.owner_id == user.id and (
            agreement.stage == "initiation"
            or agreement.status in {"correction_required", "dormant", "expiry_warning", "expiry_critical"}
            or (agreement.stage == "active" and agreement.next_action)
        )
    if role == "approver":
        return agreement.stage == "department_approval"
    if role in {"linkages", "director_linkages"}:
        return (
            agreement.stage in {"linkages_review", "vc_submission"}
            or agreement.status in {"legal_stalled", "fully_signed", "dormant", "expiry_warning", "expiry_critical", "renewal_review"}
            or (agreement.stage == "validation_signing" and agreement.status in {"awaiting_vc_signature", "awaiting_partner_signature"})
        )
    if role == "legal":
        return agreement.stage == "legal_review"
    if role == "dvc":
        return agreement.stage == "dvc_approval"
    if role == "vc_office":
        return agreement.stage in {"vc_submission", "validation_signing"}
    if role == "me":
        return agreement.stage == "active" and (
            agreement.status_color in {"orange", "red"}
            or not agreement.deliverables
            or (agreement.activated_at and utc_now() - agreement.activated_at >= timedelta(days=150))
        )
    if role == "executive":
        return agreement.status_color in {"orange", "red"}
    return True


def _format_values(agreements: list[Agreement]) -> str:
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for agreement in agreements:
        for record in agreement.values:
            if record.approved:
                totals[record.currency.upper()] += record.amount
    if not totals:
        return "No value recorded"
    return " · ".join(f"{currency} {float(amount):,.0f}" for currency, amount in sorted(totals.items()))


def _metrics_for_role(db: Session, user: User, agreements: list[Agreement], queue: list[Agreement]) -> list[dict]:
    active = [a for a in agreements if a.stage == "active" and a.status not in {"closed", "archived"}]
    pipeline = [a for a in agreements if a.stage in {"initiation", "department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"}]
    at_risk = [a for a in agreements if a.status_color in {"orange", "red"}]
    role = user.role

    if role == "researcher":
        return [
            {"label": "My agreements", "value": len(agreements), "note": "Records where you are the Champion", "icon": "agreements", "tone": "green"},
            {"label": "My pending actions", "value": len(queue), "note": "Requests or reports needing your response", "icon": "pending", "tone": "blue"},
            {"label": "Active collaborations", "value": len(active), "note": "Signed agreements in implementation", "icon": "complete", "tone": "green"},
            {"label": "At risk", "value": len(at_risk), "note": "Dormancy, expiry or overdue attention", "icon": "risk", "tone": "orange"},
        ]
    if role == "approver":
        overdue = sum(1 for a in queue if a.submitted_at and utc_now() - a.submitted_at > timedelta(days=7))
        return [
            {"label": "Awaiting approval", "value": len(queue), "note": "Requests at the department gate", "icon": "approvals", "tone": "blue"},
            {"label": "Over seven days", "value": overdue, "note": "Requests needing prompt attention", "icon": "risk", "tone": "orange"},
            {"label": "Department portfolio", "value": len(agreements), "note": "Records visible in your scope", "icon": "agreements", "tone": "green"},
            {"label": "Active from department", "value": len(active), "note": "Collaborations currently active", "icon": "complete", "tone": "green"},
        ]
    if role in {"linkages", "director_linkages"}:
        legal_stalled = sum(1 for a in agreements if a.status == "legal_stalled")
        signing = sum(1 for a in agreements if a.stage in {"vc_submission", "validation_signing"})
        return [
            {"label": "Operational queue", "value": len(queue), "note": "Records requiring Linkages action", "icon": "pending", "tone": "blue"},
            {"label": "Pipeline", "value": len(pipeline), "note": "Initiation through signing", "icon": "agreements", "tone": "green"},
            {"label": "Legal stalled", "value": legal_stalled, "note": "Legal review beyond the configured SLA", "icon": "legal", "tone": "orange"},
            {"label": "Signing follow-up", "value": signing, "note": "DVC/VC/signature-stage records", "icon": "signing", "tone": "purple"},
        ]
    if role == "legal":
        stalled = sum(1 for a in agreements if a.status == "legal_stalled")
        return [
            {"label": "Legal queue", "value": len(queue), "note": "Drafts currently requiring Legal action", "icon": "legal", "tone": "blue"},
            {"label": "Over SLA", "value": stalled, "note": "Review age greater than 21 days", "icon": "risk", "tone": "orange"},
            {"label": "Assigned matters", "value": len(agreements), "note": "Legal records visible to you", "icon": "agreements", "tone": "green"},
            {"label": "Ready to endorse", "value": sum(1 for a in agreements if a.stage == "dvc_approval"), "note": "Legal-approved packages", "icon": "complete", "tone": "green"},
        ]
    if role == "dvc":
        return [
            {"label": "Awaiting endorsement", "value": len(queue), "note": "Legally approved packages", "icon": "approvals", "tone": "blue"},
            {"label": "Endorsed packages", "value": sum(1 for a in agreements if a.stage in {"vc_submission", "validation_signing", "active"}), "note": "Records that passed the DVC gate", "icon": "complete", "tone": "green"},
            {"label": "Portfolio pipeline", "value": len(pipeline), "note": "All requests before activation", "icon": "agreements", "tone": "green"},
            {"label": "At risk", "value": len(at_risk), "note": "Read-only management attention", "icon": "risk", "tone": "orange"},
        ]
    if role == "vc_office":
        return [
            {"label": "Signing queue", "value": len(queue), "note": "Packages at VC or partner signature", "icon": "signing", "tone": "blue"},
            {"label": "Awaiting VC signature", "value": sum(1 for a in agreements if a.status == "awaiting_vc_signature"), "note": "VC signature milestone pending", "icon": "pending", "tone": "orange"},
            {"label": "Awaiting partner", "value": sum(1 for a in agreements if a.status == "awaiting_partner_signature"), "note": "Partner execution pending", "icon": "pending", "tone": "orange"},
            {"label": "Fully signed", "value": sum(1 for a in agreements if a.status == "fully_signed"), "note": "Ready for Linkages activation", "icon": "complete", "tone": "green"},
        ]
    if role == "me":
        dormant = sum(1 for a in agreements if a.status == "dormant")
        missing = sum(1 for a in agreements if a.stage == "active" and not a.deliverables)
        return [
            {"label": "Active monitoring", "value": len(active), "note": "Agreements in implementation", "icon": "monitoring", "tone": "green"},
            {"label": "Follow-up queue", "value": len(queue), "note": "Reports, risk or data gaps", "icon": "pending", "tone": "blue"},
            {"label": "Dormant", "value": dormant, "note": "No deliverable activity for 180 days", "icon": "risk", "tone": "orange"},
            {"label": "Missing baseline", "value": missing, "note": "Active agreements without deliverables", "icon": "monitoring", "tone": "purple"},
        ]
    if role == "executive":
        return [
            {"label": "Active partnerships", "value": len(active), "note": "Signed and operational", "icon": "agreements", "tone": "green"},
            {"label": "Pipeline volume", "value": len(pipeline), "note": "Requests before activation", "icon": "pending", "tone": "blue"},
            {"label": "Dormant / at risk", "value": len(at_risk), "note": "Requires management attention", "icon": "risk", "tone": "orange"},
            {"label": "Value generated", "value": _format_values(agreements), "note": "Approved values kept by currency", "icon": "value", "tone": "purple"},
        ]
    if role == "admin":
        active_users = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
        roles = db.scalar(select(func.count(func.distinct(User.role)))) or 0
        audit_events = db.scalar(select(func.count(AuditLog.id))) or 0
        return [
            {"label": "Active users", "value": active_users, "note": "Enabled institutional accounts", "icon": "users", "tone": "green"},
            {"label": "Configured roles", "value": roles, "note": "Distinct access profiles", "icon": "approvals", "tone": "blue"},
            {"label": "Audit events", "value": audit_events, "note": "Recorded material system actions", "icon": "audit", "tone": "purple"},
            {"label": "Portfolio records", "value": len(agreements), "note": "Read-only administrative visibility", "icon": "agreements", "tone": "green"},
        ]
    audit_events = db.scalar(select(func.count(AuditLog.id))) or 0
    return [
        {"label": "Authorized records", "value": len(agreements), "note": "Agreements available for review", "icon": "agreements", "tone": "green"},
        {"label": "Audit events", "value": audit_events, "note": "Material events available for inspection", "icon": "audit", "tone": "blue"},
        {"label": "At-risk records", "value": len(at_risk), "note": "Risk flags for audit sampling", "icon": "risk", "tone": "orange"},
        {"label": "Archived records", "value": sum(1 for a in agreements if a.stage == "archived"), "note": "Read-only institutional memory", "icon": "complete", "tone": "purple"},
    ]


@router.get("/workspace")
def workspace(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreements = _load_scoped_agreements(db, user)
    queue = [a for a in agreements if _is_queue_item(a, user)]
    queue.sort(key=lambda a: (0 if a.status_color == "red" else 1 if a.status_color == "orange" else 2, a.updated_at))
    queue = queue[:12]
    config = ROLE_WORKSPACES.get(user.role, ROLE_WORKSPACES["auditor"]).copy()
    config["role"] = user.role
    config["metrics"] = _metrics_for_role(db, user, agreements, queue)
    config["queue"] = [
        {
            "id": a.id,
            "reference_number": a.reference_number,
            "title": a.title,
            "partner": a.partner.name,
            "stage": a.stage,
            "status": a.status,
            "status_color": a.status_color,
            "next_action": a.next_action,
        }
        for a in queue
    ]
    return config


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreements = _load_scoped_agreements(db, user)

    active = [a for a in agreements if a.stage == "active" and a.status not in {"expired", "archived", "closed"}]
    pipeline = [a for a in agreements if a.stage in {"initiation", "department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"}]
    at_risk = [a for a in agreements if a.status_color in {"orange", "red"}]

    value_by_currency: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for agreement in agreements:
        for record in agreement.values:
            if record.approved:
                value_by_currency[record.currency.upper()] += record.amount

    stage_counts = Counter(a.stage for a in agreements)
    type_counts = Counter(a.agreement_type for a in agreements)
    risk_counts = Counter(a.status_color for a in agreements)
    recent = sorted(agreements, key=lambda a: a.updated_at, reverse=True)[:6]

    current_month = date.today().replace(day=1)
    monthly = []
    for offset in reversed(range(6)):
        month_start = _shift_month(current_month, -offset)
        next_month = _shift_month(month_start, 1)
        count = sum(1 for a in agreements if month_start <= a.created_at.date() < next_month)
        monthly.append({"month": month_start.strftime("%b %Y"), "count": count})

    currencies = [{"currency": key, "amount": float(value_by_currency[key])} for key in sorted(value_by_currency)]
    return {
        "kpis": {
            "active_partnerships": len(active),
            "pipeline_volume": len(pipeline),
            "at_risk": len(at_risk),
            "value_by_currency": currencies,
        },
        "by_stage": [{"name": key.replace("_", " ").title(), "value": value} for key, value in stage_counts.items()],
        "by_type": [{"name": key, "value": value} for key, value in type_counts.items()],
        "by_risk": [{"name": key.title(), "value": value} for key, value in risk_counts.items()],
        "monthly_pipeline": monthly,
        "recent_agreements": [
            {
                "id": a.id,
                "reference_number": a.reference_number,
                "title": a.title,
                "partner": a.partner.name,
                "stage": a.stage,
                "status": a.status,
                "status_color": a.status_color,
                "updated_at": a.updated_at,
            }
            for a in recent
        ],
    }

