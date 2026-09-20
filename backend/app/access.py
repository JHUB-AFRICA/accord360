from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import or_

from .models import Agreement, Document, User

# NOTE(rebuild-phase0): admin, director_linkages, executive, auditor and dvc
# were removed from FULL_READ_ROLES; approver and vc_office role-scoping
# branches were removed from the functions below, per REBUILD_BRIEF.md
# Section 1. The remaining logic still reflects the old stage-based model and
# is expected to be rebuilt in Phase 1 around the new 4-role/9-status model.
FULL_READ_ROLES = {"linkages"}
OPERATIONAL_EDIT_ROLES = {"linkages"}
M_AND_E_STAGES = {"validation_signing", "active", "renewal_closure"}


def apply_agreement_scope(stmt, user: User):
    """Apply role and organizational scope to Agreement queries."""
    if user.role in FULL_READ_ROLES:
        return stmt
    if user.role == "researcher":
        return stmt.where(or_(Agreement.owner_id == user.id, Agreement.initiator_id == user.id))
    if user.role == "legal":
        return stmt.where(or_(Agreement.legal_reviewer_id == user.id, Agreement.stage == "legal_review"))
    if user.role == "me":
        return stmt.where(Agreement.stage.in_(M_AND_E_STAGES))
    return stmt.where(Agreement.id == -1)


def can_view_agreement(user: User, agreement: Agreement) -> bool:
    if user.role in FULL_READ_ROLES:
        return True
    if user.role == "researcher":
        return agreement.owner_id == user.id or agreement.initiator_id == user.id
    if user.role == "legal":
        return agreement.legal_reviewer_id == user.id or agreement.stage == "legal_review"
    if user.role == "me":
        return agreement.stage in M_AND_E_STAGES
    return False


def ensure_can_view_agreement(user: User, agreement: Agreement) -> None:
    if not can_view_agreement(user, agreement):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this agreement")


def can_edit_agreement(user: User, agreement: Agreement) -> bool:
    if user.role in OPERATIONAL_EDIT_ROLES:
        return agreement.stage != "archived"
    if user.role == "researcher":
        return agreement.owner_id == user.id and agreement.stage == "initiation"
    return False


def ensure_can_edit_agreement(user: User, agreement: Agreement) -> None:
    ensure_can_view_agreement(user, agreement)
    if not can_edit_agreement(user, agreement):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This agreement is read-only for your role or current stage")


def can_upload_document(user: User, agreement: Agreement) -> bool:
    if agreement.stage == "archived":
        return False
    if user.role in {"linkages", "legal"}:
        return can_view_agreement(user, agreement)
    if user.role == "me":
        return agreement.stage in M_AND_E_STAGES
    if user.role == "researcher":
        return agreement.owner_id == user.id and agreement.stage in {"initiation", *M_AND_E_STAGES}
    return False


def can_manage_me(user: User, agreement: Agreement) -> bool:
    if agreement.stage not in M_AND_E_STAGES:
        return False
    if user.role in {"linkages", "me"}:
        return can_view_agreement(user, agreement)
    return user.role == "researcher" and agreement.owner_id == user.id


def can_manage_value(user: User, agreement: Agreement) -> bool:
    return agreement.stage in {"active", "renewal_closure"} and user.role in {"linkages", "me"} and can_view_agreement(user, agreement)


def can_download_document(user: User, agreement: Agreement, document: Document) -> bool:
    if not can_view_agreement(user, agreement):
        return False
    if document.confidentiality != "confidential":
        return True
    if user.role in {"linkages", "legal"}:
        return True
    if agreement.owner_id == user.id:
        return True
    return False
