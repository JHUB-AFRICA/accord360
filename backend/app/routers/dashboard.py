from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Agreement, Deliverable, Document, User, ValueRecord
from ..services import STAGE_ORDER, refresh_risk_status

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

STAGE_LABELS = {
    "initiation": "Initiation",
    "department_approval": "Department Approval",
    "linkages_review": "Linkages Review",
    "legal_review": "Legal Review",
    "validation_signing": "Validation & Signing",
    "active": "Active",
    "renewal_closure": "Renewal / Closure",
    "archived": "Archive",
}

ROLE_CONTEXT = {
    "researcher": {
        "title": "My partnership requests",
        "subtitle": "Create requests, respond to corrections and track progress without manual follow-up.",
        "queue_label": "Requests needing my attention",
    },
    "approver": {
        "title": "Department approval workspace",
        "subtitle": "Review academic fit, strategic alignment and departmental support within your scope.",
        "queue_label": "Pending department decisions",
    },
    "linkages": {
        "title": "Linkages operations centre",
        "subtitle": "Control intake, completeness, routing, signing coordination, renewal and portfolio quality.",
        "queue_label": "Operational actions due",
    },
    "legal": {
        "title": "Legal review workspace",
        "subtitle": "Manage assigned drafting, version review, risk decisions and the 21-day legal SLA.",
        "queue_label": "Legal matters requiring action",
    },
    "executive": {
        "title": "Executive portfolio intelligence",
        "subtitle": "See portfolio health, flow, risk and institutional value in one governed view.",
        "queue_label": "Escalations and strategic decisions",
    },
    "me": {
        "title": "Monitoring and evaluation workspace",
        "subtitle": "Track targets, actual outputs, evidence and partnership implementation discipline.",
        "queue_label": "M&E updates requiring attention",
    },
    "auditor": {
        "title": "Governance and assurance overview",
        "subtitle": "Review risk, records integrity, approvals and the institutional audit trail.",
        "queue_label": "Records requiring assurance review",
    },
    "admin": {
        "title": "System administration overview",
        "subtitle": "Monitor access, workflow health, auditability, risk signals and platform operations.",
        "queue_label": "System and workflow exceptions",
    },
}


def _scoped_statement(user: User):
    stmt = select(Agreement).options(selectinload(Agreement.partner), selectinload(Agreement.owner))
    if user.role == "researcher":
        stmt = stmt.where(Agreement.owner_id == user.id)
    elif user.role == "approver":
        stmt = stmt.where((Agreement.assigned_approver_id == user.id) | (Agreement.department == user.department))
    elif user.role == "legal":
        stmt = stmt.where((Agreement.legal_reviewer_id == user.id) | (Agreement.stage == "legal_review"))
    return stmt


def _priority_score(agreement: Agreement, user: User) -> int:
    score = 0
    if agreement.status_color == "red":
        score += 100
    elif agreement.status_color == "orange":
        score += 70
    elif agreement.status_color == "yellow":
        score += 30

    role_stages = {
        "researcher": {"initiation"},
        "approver": {"department_approval"},
        "linkages": {"linkages_review", "validation_signing", "renewal_closure"},
        "legal": {"legal_review"},
        "executive": {"renewal_closure", "active"},
        "me": {"active"},
        "auditor": set(STAGE_ORDER),
        "admin": set(STAGE_ORDER),
    }
    if agreement.stage in role_stages.get(user.role, set()):
        score += 50
    if user.role == "researcher" and agreement.status == "correction_required":
        score += 80
    score += min(agreement.days_in_stage, 30)
    return score


@router.get("/stats")
def stats(
    department: str | None = None,
    agreement_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = _scoped_statement(user)
    if department:
        stmt = stmt.where(Agreement.department == department)
    if agreement_type:
        stmt = stmt.where(Agreement.agreement_type == agreement_type)

    agreements = db.scalars(stmt).all()
    for item in agreements:
        refresh_risk_status(item)
    db.commit()

    agreement_ids = [a.id for a in agreements]
    deliverables = []
    documents = []
    if agreement_ids:
        deliverables = db.scalars(select(Deliverable).where(Deliverable.agreement_id.in_(agreement_ids))).all()
        documents = db.scalars(select(Document).where(Document.agreement_id.in_(agreement_ids))).all()

    last_me_update: dict[int, date] = {}
    for row in deliverables:
        current = last_me_update.get(row.agreement_id)
        updated = row.last_updated_at.date()
        if current is None or updated > current:
            last_me_update[row.agreement_id] = updated

    today = date.today()
    dormant_ids: set[int] = set()
    for agreement in agreements:
        if agreement.stage != "active":
            continue
        anchor = last_me_update.get(agreement.id)
        if anchor is None and agreement.activated_at:
            anchor = agreement.activated_at.date()
        if anchor and (today - anchor).days >= 180:
            dormant_ids.add(agreement.id)

    active = [a for a in agreements if a.stage == "active" and a.status not in {"expired", "archived", "closed"}]
    pipeline = [a for a in agreements if a.stage in {"initiation", "department_approval", "linkages_review", "legal_review", "validation_signing"}]
    at_risk = [a for a in agreements if a.status_color in {"orange", "red"} or a.id in dormant_ids]

    total_value = Decimal("0")
    if agreement_ids:
        total_value = db.scalar(
            select(func.coalesce(func.sum(ValueRecord.amount), 0)).where(
                ValueRecord.agreement_id.in_(agreement_ids), ValueRecord.approved.is_(True)
            )
        ) or Decimal("0")

    stage_counts = Counter(a.stage for a in agreements)
    type_counts = Counter(a.agreement_type for a in agreements)
    risk_counts = Counter(a.status_color for a in agreements)
    recent = sorted(agreements, key=lambda a: a.updated_at, reverse=True)[:6]

    monthly = []
    for offset in reversed(range(6)):
        month_start = (today.replace(day=1) - timedelta(days=offset * 31)).replace(day=1)
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        count = sum(1 for a in agreements if month_start <= a.created_at.date() < next_month)
        monthly.append({"month": month_start.strftime("%b"), "count": count})

    priority = sorted(agreements, key=lambda a: _priority_score(a, user), reverse=True)
    priority = [a for a in priority if _priority_score(a, user) >= 50][:8]

    legal_stalled = sum(1 for a in agreements if a.stage == "legal_review" and a.days_in_stage > 21)
    renewal_warning = sum(1 for a in active if a.expiry_days is not None and 91 <= a.expiry_days <= 183)
    expiry_critical = sum(1 for a in active if a.expiry_days is not None and a.expiry_days <= 90)
    evidence_documents = sum(1 for d in documents if d.document_type == "evidence")
    total_target = sum(float(d.target_value or 0) for d in deliverables)
    total_actual = sum(float(d.actual_value or 0) for d in deliverables)
    attainment = round((total_actual / total_target) * 100, 1) if total_target else 0

    return {
        "role_context": ROLE_CONTEXT.get(user.role, ROLE_CONTEXT["researcher"]),
        "filters": {
            "departments": sorted({a.department for a in agreements}),
            "agreement_types": sorted({a.agreement_type for a in agreements}),
            "selected_department": department,
            "selected_agreement_type": agreement_type,
        },
        "kpis": {
            "active_partnerships": len(active),
            "pipeline_volume": len(pipeline),
            "at_risk": len(at_risk),
            "total_value": float(total_value),
            "currency": "KES",
        },
        "guardrails": [
            {"key": "legal_stalled", "label": "Legal stagnation", "value": legal_stalled, "level": "red", "rule": "Review exceeds 21 days"},
            {"key": "renewal_warning", "label": "Proactive renewal", "value": renewal_warning, "level": "orange", "rule": "Expiry within six months"},
            {"key": "dormant", "label": "Dormancy trigger", "value": len(dormant_ids), "level": "red", "rule": "No M&E update for 180 days"},
            {"key": "expiry_critical", "label": "Critical expiry", "value": expiry_critical, "level": "red", "rule": "Expiry within 90 days"},
        ],
        "me_summary": {
            "deliverables": len(deliverables),
            "evidence_documents": evidence_documents,
            "attainment_percent": attainment,
            "dormant_agreements": len(dormant_ids),
        },
        "by_stage": [
            {"key": "initiation", "name": "Initiation", "value": stage_counts.get("initiation", 0)},
            {"key": "department_approval", "name": "Department Approval", "value": stage_counts.get("department_approval", 0)},
            {"key": "linkages_review", "name": "Linkages Review", "value": stage_counts.get("linkages_review", 0)},
            {"key": "legal_review", "name": "Legal Review", "value": stage_counts.get("legal_review", 0)},
            {"key": "validation_signing", "name": "Validation & Signing", "value": sum(1 for a in agreements if a.stage == "validation_signing" and a.status != "fully_signed")},
            {"key": "activation", "name": "Activation", "value": sum(1 for a in agreements if a.stage == "validation_signing" and a.status == "fully_signed")},
            {"key": "active", "name": "Monitoring & Evaluation", "value": stage_counts.get("active", 0)},
            {"key": "renewal_closure", "name": "Renewal / Closure / Archive", "value": stage_counts.get("renewal_closure", 0) + stage_counts.get("archived", 0)},
        ],
        "by_type": [{"name": key, "value": value} for key, value in sorted(type_counts.items())],
        "by_risk": [{"name": key.title(), "value": value} for key, value in sorted(risk_counts.items())],
        "monthly_pipeline": monthly,
        "priority_queue": [
            {
                "id": a.id,
                "reference_number": a.reference_number,
                "title": a.title,
                "partner": a.partner.name,
                "stage": a.stage,
                "status": a.status,
                "status_color": a.status_color,
                "next_action": a.next_action,
                "days_in_stage": a.days_in_stage,
                "sla_state": a.sla_state,
            }
            for a in priority
        ],
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
