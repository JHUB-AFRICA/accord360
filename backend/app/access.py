from __future__ import annotations

from fastapi import HTTPException, status

from .models import Agreement, User

# Visibility rules — REBUILD_BRIEF.md Section 2.7:
#   researcher -> only Agreements where Agreement.researcher == current_user
#   linkages -> ALL agreements and versions
#   legal    -> ALL agreements and versions (same as linkages)
#   me       -> ALL agreements' status/progress data
FULL_READ_ROLES = {"linkages", "legal", "me"}


def apply_agreement_scope(stmt, user: User):
    """Apply role-based visibility to Agreement queries (Section 2.7)."""
    if user.role in FULL_READ_ROLES:
        return stmt
    if user.role == "researcher":
        return stmt.where(Agreement.researcher_id == user.id)
    return stmt.where(Agreement.id == -1)


def can_view_agreement(user: User, agreement: Agreement) -> bool:
    if user.role in FULL_READ_ROLES:
        return True
    if user.role == "researcher":
        return agreement.researcher_id == user.id
    return False


def ensure_can_view_agreement(user: User, agreement: Agreement) -> None:
    if not can_view_agreement(user, agreement):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agreement not found")


def can_edit_agreement(user: User, agreement: Agreement) -> bool:
    """Basic field edits (title/department/dates) prior to document
    generation locking the record. Section 2.3's upload matrix governs
    AgreementVersion mutation, not this.
    """
    if agreement.status in {"fully_executed", "archived"}:
        return False
    if user.role == "linkages":
        return True
    if user.role == "researcher":
        return agreement.researcher_id == user.id and agreement.status == "draft_generated"
    return False


def ensure_can_edit_agreement(user: User, agreement: Agreement) -> None:
    ensure_can_view_agreement(user, agreement)
    if not can_edit_agreement(user, agreement):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This agreement is read-only for your role or current status")


# Status permission matrix — REBUILD_BRIEF.md Section 2.3. Server-side single
# source of truth; the frontend must derive visible actions from the API
# (e.g. AgreementDetailOut.available_actions), never hardcode a duplicate.
UPLOAD_ALLOWED_ROLES_BY_STATUS: dict[str, set[str]] = {
    # The Researcher submission creates the intake record. Linkages uploads
    # the first legal agreement draft after reviewing that intake.
    "draft_generated": {"linkages"},
    "linkages_review": set(),
    "legal_review": set(),
    "returned_to_researcher": set(),
    "approved_for_signing": set(),
    "awaiting_signatures": set(),
    "fully_executed": set(),
    "expired": {"me"},
    "archived": set(),
}

def can_upload_new_version(user: User, agreement: Agreement) -> bool:
    return user.role in UPLOAD_ALLOWED_ROLES_BY_STATUS.get(agreement.status, set())
