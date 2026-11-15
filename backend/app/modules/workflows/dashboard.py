from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ...access import apply_agreement_scope
from ...db.session import get_db
from ...deps import get_current_user
from ...models import Agreement, AuditLog, User
from ..workflows.models import WorkflowEvent
from ..agreements.models import AGREEMENT_STATUSES

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Exactly the four roles per REBUILD_BRIEF.md Section 2.1 — no entries for
# any removed role.
ROLE_WORKSPACES = {
    "researcher": {
        "role_label": "JKUAT Researcher",
        "eyebrow": "Researcher workspace",
        "title": "My collaboration agreements",
        "description": "Propose agreements, track their status and submit quarterly progress updates once executed.",
        "permission_summary": "You can see only agreements where you are the Researcher.",
        "capabilities": ["Propose agreements", "Track own agreements", "Submit progress updates"],
        "guidance": [
            "Fill the structured form to propose a new agreement.",
            "Track review/correction progress on your drafts.",
            "Submit quarterly progress updates once the agreement is fully executed.",
        ],
        "queue_title": "My agreements needing attention",
        "queue_description": "Only agreements where you are the Researcher are shown.",
        "primary_action": {"label": "New agreement request", "path": "/agreements/new"},
    },
    "linkages": {
        "role_label": "Linkages Officer",
        "eyebrow": "Operational management",
        "title": "Agreement workflow control centre",
        "description": "Verify partners, manage templates, re-upload corrected drafts and coordinate signing.",
        "permission_summary": "You can see all agreements and act on Linkages-owned status transitions.",
        "capabilities": ["Manage templates", "Re-upload corrected drafts", "Coordinate signing", "Upload final signed scan"],
        "guidance": [
            "Resubmit corrected drafts for Legal verification.",
            "Move approved agreements into signing.",
            "Upload the final signed scan once execution is complete.",
        ],
        "queue_title": "Linkages operational queue",
        "queue_description": "Agreements awaiting a Linkages-owned action.",
        "primary_action": {"label": "Manage templates", "path": "/templates"},
    },
    "legal": {
        "role_label": "Legal Office Reviewer",
        "eyebrow": "Legal workspace",
        "title": "Draft review and verification",
        "description": "Comment on drafts, request corrections and verify corrected versions.",
        "permission_summary": "You can see all agreements and act on Legal-owned status transitions. You never upload files.",
        "capabilities": ["Comment on drafts", "Request corrections", "Verify corrections", "Approve for signing"],
        "guidance": [
            "Review drafts pending legal review.",
            "Request corrections or approve for signing.",
            "Verify corrected drafts resubmitted by Linkages.",
        ],
        "queue_title": "Legal review queue",
        "queue_description": "Agreements currently pending Legal review or verification.",
        "primary_action": None,
    },
    "me": {
        "role_label": "M&E Officer",
        "eyebrow": "Implementation accountability",
        "title": "Monitoring and evaluation workspace",
        "description": "Monitor progress updates, expiry alerts, and update or archive expired agreements.",
        "permission_summary": "You can see all agreements' status/progress data and act on Expired-status agreements.",
        "capabilities": ["Monitor progress updates", "Track expiry alerts", "Renew or archive expired agreements"],
        "guidance": [
            "Review quarterly progress updates across all agreements.",
            "Watch for expiry alerts ahead of the end date.",
            "Update (renew) or archive agreements once they expire.",
        ],
        "queue_title": "Expired agreements requiring action",
        "queue_description": "Agreements in Expired status awaiting an Update or Archive decision.",
        "primary_action": None,
    },
}


def _load_scoped_agreements(db: Session, user: User) -> list[Agreement]:
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.researcher),
    )
    return list(db.scalars(apply_agreement_scope(stmt, user)).all())


def _is_queue_item(agreement: Agreement, user: User) -> bool:
    role = user.role
    if role == "researcher":
        return agreement.researcher_id == user.id and agreement.status in {
            "returned_to_researcher",
            "expired",
        }
    if role == "linkages":
        return agreement.status in {"linkages_review", "approved_for_signing", "awaiting_signatures"}
    if role == "legal":
        return agreement.status == "legal_review"
    if role == "me":
        return agreement.status == "expired"
    return False


def _metrics_for_role(db: Session, user: User, agreements: list[Agreement], queue: list[Agreement]) -> list[dict]:
    role = user.role
    fully_executed = sum(1 for a in agreements if a.status == "fully_executed")
    expired = sum(1 for a in agreements if a.status == "expired")

    if role == "researcher":
        return [
            {"label": "My agreements", "value": len(agreements), "note": "Records where you are the Researcher", "icon": "agreements", "tone": "green", "statuses": []},
            {"label": "Needing my attention", "value": len(queue), "note": "Corrections or renewal-related items", "icon": "pending", "tone": "blue", "statuses": ["returned_to_researcher", "expired"]},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green", "statuses": ["fully_executed"]},
            {"label": "Expired", "value": expired, "note": "Awaiting M&E action", "icon": "risk", "tone": "orange", "statuses": ["expired"]},
        ]
    if role == "linkages":
        approved = sum(1 for a in agreements if a.status == "approved_for_signing")
        return [
            {"label": "Approved by Legal", "value": approved, "note": "Ready to start signing", "icon": "complete", "tone": "green", "statuses": ["approved_for_signing"]},
            {"label": "Operational queue", "value": len(queue), "note": "Records requiring Linkages action", "icon": "pending", "tone": "blue", "statuses": ["linkages_review", "approved_for_signing", "awaiting_signatures"]},
            {"label": "Portfolio", "value": len(agreements), "note": "All agreements", "icon": "agreements", "tone": "green", "statuses": []},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green", "statuses": ["fully_executed"]},
            {"label": "Expired", "value": expired, "note": "Awaiting M&E renewal/archive", "icon": "risk", "tone": "orange", "statuses": ["expired"]},
        ]
    if role == "legal":
        return [
            {"label": "Legal queue", "value": len(queue), "note": "Drafts currently requiring Legal action", "icon": "legal", "tone": "blue", "statuses": ["legal_review"]},
            {"label": "Portfolio", "value": len(agreements), "note": "All agreements", "icon": "agreements", "tone": "green", "statuses": []},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green", "statuses": ["fully_executed"]},
        ]
    if role == "me":
        return [
            {"label": "Expired, needs action", "value": len(queue), "note": "Update or archive", "icon": "pending", "tone": "orange", "statuses": ["expired"]},
            {"label": "Portfolio", "value": len(agreements), "note": "All agreements", "icon": "agreements", "tone": "green", "statuses": []},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green", "statuses": ["fully_executed"]},
        ]
    return [
        {"label": "Portfolio", "value": len(agreements), "note": "Visible agreements", "icon": "agreements", "tone": "green", "statuses": []},
    ]


@router.get("/workspace")
def workspace(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreements = _load_scoped_agreements(db, user)
    queue = [a for a in agreements if _is_queue_item(a, user)]
    queue.sort(key=lambda a: a.updated_at)
    queue = queue[:25]
    # Which queued agreements were last moved by Legal returning them to
    # Linkages (vs. a fresh Researcher submission) — one lookup, not N.
    returned_ids: set[int] = set()
    review_ids = [a.id for a in queue if a.status == "linkages_review"]
    if review_ids:
        latest = (
            select(WorkflowEvent.agreement_id, func.max(WorkflowEvent.id).label("last_id"))
            .where(WorkflowEvent.agreement_id.in_(review_ids))
            .group_by(WorkflowEvent.agreement_id)
            .subquery()
        )
        returned_ids = set(
            db.scalars(
                select(WorkflowEvent.agreement_id)
                .join(latest, WorkflowEvent.id == latest.c.last_id)
                .where(WorkflowEvent.action == "return_to_linkages")
            ).all()
        )
    config = ROLE_WORKSPACES.get(user.role, ROLE_WORKSPACES["me"]).copy()
    config["role"] = user.role
    config["metrics"] = _metrics_for_role(db, user, agreements, queue)
    config["queue"] = [
        {
            "id": a.id,
            "title": a.title,
            "partner": a.partner.name,
            "status": a.status,
            "department": a.department,
            "researcher": a.researcher.full_name if a.researcher else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            "returned_by_legal": a.id in returned_ids,
        }
        for a in queue
    ]
    return config


def _monthly_created(agreements: list[Agreement], months: int = 6) -> list[dict]:
    """Agreements created per month, oldest to newest, zero-filled so the
    trend line is always `months` points long even with no data yet."""
    today = date.today().replace(day=1)
    buckets: dict[str, int] = {}
    cursor = today
    for _ in range(months):
        buckets[cursor.strftime("%Y-%m")] = 0
        cursor = (cursor.replace(day=1) - timedelta(days=1)).replace(day=1)
    for agreement in agreements:
        key = agreement.created_at.strftime("%Y-%m")
        if key in buckets:
            buckets[key] += 1
    ordered_keys = sorted(buckets.keys())
    return [{"month": key, "count": buckets[key]} for key in ordered_keys]


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreements = _load_scoped_agreements(db, user)
    status_counts = Counter(a.status for a in agreements)
    department_counts = Counter(a.department for a in agreements)
    recent = sorted(agreements, key=lambda a: a.updated_at, reverse=True)[:6]

    return {
        "kpis": {
            "total_agreements": len(agreements),
            "fully_executed": status_counts.get("fully_executed", 0),
            "expired": status_counts.get("expired", 0),
            "archived": status_counts.get("archived", 0),
        },
        "by_status": [
            {"status": status, "name": status.replace("_", " ").title(), "value": status_counts.get(status, 0)}
            for status in AGREEMENT_STATUSES
        ],
        "by_department": [{"name": key, "value": value} for key, value in department_counts.items()],
        "monthly_created": _monthly_created(agreements),
        "recent_agreements": [
            {
                "id": a.id,
                "title": a.title,
                "partner": a.partner.name,
                "status": a.status,
                "updated_at": a.updated_at,
            }
            for a in recent
        ],
    }
