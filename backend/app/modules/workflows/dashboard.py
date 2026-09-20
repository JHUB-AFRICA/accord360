from __future__ import annotations

from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ...access import apply_agreement_scope
from ...db.session import get_db
from ...deps import get_current_user
from ...models import Agreement, AuditLog, User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Exactly the four roles per REBUILD_BRIEF.md Section 2.1 — no entries for
# any removed role.
ROLE_WORKSPACES = {
    "champion": {
        "role_label": "JKUAT Champion",
        "eyebrow": "Champion workspace",
        "title": "My collaboration agreements",
        "description": "Propose agreements, track their status and submit quarterly progress updates once executed.",
        "permission_summary": "You can see only agreements where you are the Champion.",
        "capabilities": ["Propose agreements", "Track own agreements", "Submit progress updates"],
        "guidance": [
            "Fill the structured form to propose a new agreement.",
            "Track review/correction progress on your drafts.",
            "Submit quarterly progress updates once the agreement is fully executed.",
        ],
        "queue_title": "My agreements needing attention",
        "queue_description": "Only agreements where you are the Champion are shown.",
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
        selectinload(Agreement.champion),
    )
    return list(db.scalars(apply_agreement_scope(stmt, user)).all())


def _is_queue_item(agreement: Agreement, user: User) -> bool:
    role = user.role
    if role == "champion":
        return agreement.champion_id == user.id and agreement.status in {
            "returned_for_corrections",
            "expired",
        }
    if role == "linkages":
        return agreement.status in {"returned_for_corrections", "approved_for_signing", "awaiting_signatures"}
    if role == "legal":
        return agreement.status in {"pending_legal_review", "pending_legal_verification"}
    if role == "me":
        return agreement.status == "expired"
    return False


def _metrics_for_role(db: Session, user: User, agreements: list[Agreement], queue: list[Agreement]) -> list[dict]:
    role = user.role
    fully_executed = sum(1 for a in agreements if a.status == "fully_executed")
    expired = sum(1 for a in agreements if a.status == "expired")

    if role == "champion":
        return [
            {"label": "My agreements", "value": len(agreements), "note": "Records where you are the Champion", "icon": "agreements", "tone": "green"},
            {"label": "Needing my attention", "value": len(queue), "note": "Corrections or renewal-related items", "icon": "pending", "tone": "blue"},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green"},
            {"label": "Expired", "value": expired, "note": "Awaiting M&E action", "icon": "risk", "tone": "orange"},
        ]
    if role == "linkages":
        return [
            {"label": "Operational queue", "value": len(queue), "note": "Records requiring Linkages action", "icon": "pending", "tone": "blue"},
            {"label": "Portfolio", "value": len(agreements), "note": "All agreements", "icon": "agreements", "tone": "green"},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green"},
            {"label": "Expired", "value": expired, "note": "Awaiting M&E renewal/archive", "icon": "risk", "tone": "orange"},
        ]
    if role == "legal":
        return [
            {"label": "Legal queue", "value": len(queue), "note": "Drafts currently requiring Legal action", "icon": "legal", "tone": "blue"},
            {"label": "Portfolio", "value": len(agreements), "note": "All agreements", "icon": "agreements", "tone": "green"},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green"},
        ]
    if role == "me":
        return [
            {"label": "Expired, needs action", "value": len(queue), "note": "Update or archive", "icon": "pending", "tone": "orange"},
            {"label": "Portfolio", "value": len(agreements), "note": "All agreements", "icon": "agreements", "tone": "green"},
            {"label": "Fully executed", "value": fully_executed, "note": "Signed and in force", "icon": "complete", "tone": "green"},
        ]
    return [
        {"label": "Portfolio", "value": len(agreements), "note": "Visible agreements", "icon": "agreements", "tone": "green"},
    ]


@router.get("/workspace")
def workspace(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreements = _load_scoped_agreements(db, user)
    queue = [a for a in agreements if _is_queue_item(a, user)]
    queue.sort(key=lambda a: a.updated_at)
    queue = queue[:12]
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
        }
        for a in queue
    ]
    return config


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
        "by_status": [{"name": key.replace("_", " ").title(), "value": value} for key, value in status_counts.items()],
        "by_department": [{"name": key, "value": value} for key, value in department_counts.items()],
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
