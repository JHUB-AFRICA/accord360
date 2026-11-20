"""Agreement domain service.

Holds the business logic for the agreement lifecycle: listing/scoping,
creation, detail retrieval, updates and status transitions. Routers in this
module should only parse the request, call one of these functions, and
return/raise based on the result.

Per REBUILD_BRIEF.md Section 2, Phase 1 only needs the Agreement status
state machine itself (Section 2.4's transition graph) working end to end
with role gating — comment CRUD, version-upload endpoints and the document
generation engine are Phase 2/3 work and are intentionally not built here.
"""

from __future__ import annotations

from pathlib import Path
from io import BytesIO
import re
import zipfile
from fastapi import HTTPException, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload
from uuid import uuid4
from dateutil.relativedelta import relativedelta

from ...access import (
    apply_agreement_scope,
    ensure_can_edit_agreement,
    ensure_can_view_agreement,
)
from ...deps import audit
from ...core.config import settings
from ...timeutils import utc_now
from .models import Agreement, AgreementDrivePermission, AgreementVersion, ProgressUpdate
from app.integrations import google_drive
from app.integrations.google_drive import DriveError
from app.utils import storage
from app.modules.partners.models import Partner
from app.modules.users.models import User
from app.modules.workflows.models import WorkflowEvent
from app.modules.templates import service as template_service
from app.modules.templates.models import Template
from .schemas import AgreementCreate, AgreementDetailOut, AgreementUpdate, ProgressUpdateCreate
from app.modules.workflows.schemas import TransitionRequest
from ..workflows.service import notify_roles, notify_user, resolve_notifications

__all__ = [
    "notify_roles",
    "LOAD_OPTIONS",
    "scoped_query",
    "list_agreements",
    "create_agreement",
    "get_agreement_detail",
    "update_agreement",
    "transition_agreement",
    "add_agreement_version",
    "upload_final_signed_document",
    "export_signing_copy",
    "available_actions",
    "create_progress_update",
    "list_progress_updates",
    "desired_drive_access",
    "inspect_drive_access",
    "reconcile_drive_access",
    "reconcile_agreements_for_people",
]

MAX_SIGNED_FILE_SIZE = 25 * 1024 * 1024
PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
SIGNING_EXPORTS = {"pdf": (PDF_MIME, ".pdf"), "docx": (DOCX_MIME, ".docx")}

LOAD_OPTIONS = (
    selectinload(Agreement.partner),
    selectinload(Agreement.researcher),
    selectinload(Agreement.versions).selectinload(AgreementVersion.uploaded_by),
    selectinload(Agreement.progress_updates),
    selectinload(Agreement.workflow_events).selectinload(WorkflowEvent.actor),
)

RESEARCHER_EDIT_FIELDS = {"title", "department", "start_date", "end_date"}

# Status transition graph — REBUILD_BRIEF.md Section 2.4. Only the
# user-triggered edges are exposed via TransitionRequest; the two
# The researcher submission creates draft_generated and notifies Linkages.
# Linkages' Phase 2 draft upload will transition draft_generated to
# pending_legal_review. The fully_executed -> expired edge belongs to the
# daily expiry job and is not reachable through this table.
# (from_status, action) -> (to_status, allowed_roles)
TRANSITIONS: dict[tuple[str, str], tuple[str, set[str]]] = {
    # Researcher confirms the partner's edits are satisfactory and submits to
    # Linkages. The partner is cut off from the Doc at this point.
    ("draft_generated", "submit"): ("linkages_review", {"researcher"}),
    # Linkages reviews/edits the Doc, then either sends it to Legal or back to
    # the Researcher. Every agreement goes through Legal before signing.
    ("linkages_review", "send_to_legal"): ("legal_review", {"linkages"}),
    ("linkages_review", "return_to_researcher"): ("returned_to_researcher", {"linkages"}),
    # Legal comments/edits in the Doc, then returns it to Linkages or approves.
    ("legal_review", "return_to_linkages"): ("linkages_review", {"legal"}),
    ("legal_review", "approve"): ("approved_for_signing", {"legal"}),
    ("returned_to_researcher", "resubmit"): ("linkages_review", {"researcher"}),
    ("approved_for_signing", "start_signing"): ("awaiting_signatures", {"linkages"}),
    # Safety valve: if the Doc's content changed after Legal approved it,
    # Linkages sends it back through Legal review instead of being stuck on a
    # "changed after approval" error. Only offered/allowed when a change is
    # actually detected (see SEND_BACK_TO_LEGAL_STATUSES).
    ("approved_for_signing", "send_to_legal"): ("legal_review", {"linkages"}),
    ("awaiting_signatures", "send_to_legal"): ("legal_review", {"linkages"}),
    ("awaiting_signatures", "mark_fully_executed"): ("fully_executed", {"linkages"}),
    # TODO(spec): confirm exact renewal semantics with Linkages Office
    # (Section 2.5) — minimum implemented default: expired -> approved_for_signing.
    ("expired", "renew"): ("approved_for_signing", {"me"}),
    ("expired", "archive"): ("archived", {"me"}),
}


# From Legal approval onward nobody edits the Doc: everyone with direct access
# is a reader, so the approved text cannot drift before signing.
DRIVE_READ_ONLY_STATUSES = {"approved_for_signing", "awaiting_signatures", "fully_executed", "expired", "archived"}
# Statuses where "send_to_legal" means "send back for re-review because the
# approved Doc changed" and is gated on that change being detected.
SEND_BACK_TO_LEGAL_STATUSES = {"approved_for_signing", "awaiting_signatures"}


def _doc_changed_since_approval(agreement: Agreement) -> bool | None:
    """True/False when the approved Doc's content did/didn't change since Legal
    approval; None when unknown (no snapshot, no Doc, or Drive unreachable)."""
    if agreement.status not in SEND_BACK_TO_LEGAL_STATUSES:
        return None
    if not (agreement.approved_doc_modified_at and agreement.template_copy_doc_id):
        return None
    current = google_drive.get_modified_time(agreement.template_copy_doc_id)
    if not current:
        return None
    return current > agreement.approved_doc_modified_at


def _transition_recipient_roles(to_status: str) -> set[str]:
    """Notification recipients for a status change (kept minimal; the full
    7-trigger notification table is Phase 3, Section 4.6).
    """
    mapping = {
        "linkages_review": {"linkages"},
        "legal_review": {"legal"},
        "returned_to_researcher": set(),  # the agreement's own Researcher is notified explicitly
        "approved_for_signing": {"linkages"},
        "awaiting_signatures": {"linkages"},
        # The agreement's own Researcher is notified explicitly at the final
        # upload because notify_roles cannot scope a role to one agreement.
        "fully_executed": {"legal", "me"},
        "expired": {"me"},
        "archived": {"me"},
    }
    return mapping.get(to_status, set())


def available_actions(user: User, agreement: Agreement) -> list[str]:
    """Actions this user may currently perform, derived from TRANSITIONS —
    single source of truth for Section 5.2's `available_actions` field.
    """
    return [
        action
        for (from_status, action), (_, roles) in TRANSITIONS.items()
        if from_status == agreement.status and user.role in roles
    ]


def _active_grants(db: Session, agreement: Agreement, *, role: str) -> list[AgreementDrivePermission]:
    return list(
        db.scalars(
            select(AgreementDrivePermission).where(
                AgreementDrivePermission.agreement_id == agreement.id,
                AgreementDrivePermission.role == role,
                AgreementDrivePermission.revoked_at.is_(None),
            )
        ).all()
    )


def _grant_drive_access(
    db: Session, agreement: Agreement, *, role: str, email: str, drive_role: str = "writer", message: str | None = None
) -> None:
    """Grant Drive access and record it — GOOGLE_DOCS_DRAFTING_BRIEF.md
    Section 4. Every grant MUST be recorded here so revocation (below) can
    go through the stored permission_id instead of a permissions.list call.
    Idempotent: an existing active grant for the same role and email is kept.
    Only the initial external-partner grant sends Google's sharing email;
    internal workflow handoffs are delivered by in-app notifications.
    """
    if any(g.email.lower() == email.lower() for g in _active_grants(db, agreement, role=role)):
        return
    notify = role == "partner"
    permission_id = google_drive.grant_permission(
        agreement.template_copy_doc_id, email, role=drive_role,
        notify=notify, message=message if notify else None,
    )
    db.add(
        AgreementDrivePermission(
            agreement_id=agreement.id,
            role=role,
            email=email,
            permission_id=permission_id,
        )
    )
    db.flush()  # session autoflush is off; later idempotency/shared-id checks must see this row


def _revoke_drive_access(db: Session, agreement: Agreement, *, role: str) -> None:
    """Revoke every un-revoked grant for `role` on this agreement's doc, using
    the locally stored permission_ids — never a live permissions.list lookup.

    Drive hands back the same permission id when the same Google account is
    granted twice (e.g. one person holding two roles), so a Drive-side delete
    is skipped while another active local grant still shares that id.
    """
    for grant in _active_grants(db, agreement, role=role):
        shared = db.scalar(
            select(AgreementDrivePermission.id).where(
                AgreementDrivePermission.agreement_id == agreement.id,
                AgreementDrivePermission.permission_id == grant.permission_id,
                AgreementDrivePermission.revoked_at.is_(None),
                AgreementDrivePermission.id != grant.id,
                AgreementDrivePermission.role != role,
            )
        )
        if shared is None:
            google_drive.revoke_permission(agreement.template_copy_doc_id, grant.permission_id)
        grant.revoked_at = utc_now()
        db.flush()


def _canonical_email(email: str) -> str:
    """Compare addresses the way Google does: Gmail ignores dots and +tags and
    treats googlemail.com as gmail.com, and Drive reports the canonical form."""
    value = (email or "").strip().lower()
    local, _, domain = value.partition("@")
    if domain in {"gmail.com", "googlemail.com"}:
        return local.split("+", 1)[0].replace(".", "") + "@gmail.com"
    return value


def _staff_emails(db: Session, role: str) -> list[str]:
    return [m.email for m in db.scalars(select(User).where(User.role == role, User.is_active.is_(True))).all()]


def _grant_staff(db: Session, agreement: Agreement, role: str, message: str | None = None) -> None:
    for email in _staff_emails(db, role):
        _grant_drive_access(db, agreement, role=role, email=email, message=message)


def desired_drive_access(db: Session, agreement: Agreement, status: str | None = None) -> list[dict[str, str]]:
    """Return the direct Drive access required for an agreement status.

    This is the single policy used by reconciliation.  A person's email is
    normalized for comparison, while the original casing is retained for a
    newly-created permission.  Multiple roles may intentionally resolve to the
    same email; Drive receives one permission and local records retain the
    role-specific reason for that access.
    """
    status = status or agreement.status
    rows: list[dict[str, str]] = []
    drive_role = "reader" if status in DRIVE_READ_ONLY_STATUSES else "writer"

    researcher = agreement.researcher or db.get(User, agreement.researcher_id)
    if researcher and researcher.email and researcher.is_active:
        rows.append({"role": "researcher", "email": researcher.email, "drive_role": drive_role})

    partner = agreement.partner or db.get(Partner, agreement.partner_id)
    if status == "draft_generated" and partner and partner.contact_email:
        rows.append({"role": "partner", "email": partner.contact_email, "drive_role": drive_role})

    if status in {"linkages_review", "legal_review", "returned_to_researcher", "approved_for_signing", "awaiting_signatures", "fully_executed", "expired", "archived"}:
        rows.extend({"role": "linkages", "email": email, "drive_role": drive_role} for email in _staff_emails(db, "linkages"))
    if status == "legal_review":
        rows.extend({"role": "legal", "email": email, "drive_role": drive_role} for email in _staff_emails(db, "legal"))
    return rows


# Drive roles that come from owning or organising the Shared Drive itself.
# They are never workflow grants and are never stripped from a Doc.
PROTECTED_DRIVE_ROLES = {"owner", "organizer", "fileOrganizer"}


def _is_inherited_permission(permission: dict | None) -> bool:
    if not permission:
        return False
    details = permission.get("permissionDetails") or []
    return any(detail.get("inherited") or detail.get("inheritedFrom") for detail in details)


def _permission_label(permission: dict) -> str:
    if permission.get("emailAddress"):
        return permission["emailAddress"]
    if permission.get("type") == "anyone":
        return "anyone with the link"
    if permission.get("domain"):
        return f"domain:{permission['domain']}"
    return f"{permission.get('type', 'unknown')}:{permission.get('id')}"


def reconcile_drive_access(
    db: Session, agreement: Agreement, target_status: str | None = None, *, notify: bool = True
) -> dict:
    """Make direct Drive permissions match the status-driven access policy.

    The policy is an allow-list: after the required access is in place, every
    *direct* permission on the Doc that the policy did not ask for is removed
    — workflow grants that are no longer needed, shares an editor added by
    hand, "anyone with the link" and domain links alike.  Only inherited
    access (Shared Drive membership), owner/organizer roles and the service
    account itself are left alone.  Removals are re-checked against Drive
    afterwards; a permission that survives raises DriveError so the caller
    leaves the workflow status unchanged and the action can be retried.

    The operation is safe to retry: it adopts matching permissions already in
    Drive and adds missing access before revoking anything, so a failed
    hand-off never removes the only participant who can continue.
    """
    if not agreement.template_copy_doc_id:
        raise DriveError("Agreement has no Google Drive document to reconcile")
    doc_id = agreement.template_copy_doc_id
    target_status = target_status or agreement.status
    desired = desired_drive_access(db, agreement, target_status)
    desired_by_key = {(item["role"], item["email"].strip().lower()): item for item in desired}
    desired_emails = {item["email"].strip().lower() for item in desired}
    live = True
    try:
        current = google_drive.list_permissions(doc_id)
    except DriveError:
        # Unit tests and local prototype mode often use the in-memory Drive
        # grant stubs with Drive disabled. Production always lists live Drive
        # permissions; this fallback keeps the local workflow usable while
        # still surfacing errors when the integration is enabled.
        if settings.google_drive_enabled and settings.environment != "test":
            raise
        live = False
        current = [
            {"id": grant.permission_id, "type": "user", "emailAddress": grant.email, "role": "writer"}
            for grant in db.scalars(select(AgreementDrivePermission).where(
                AgreementDrivePermission.agreement_id == agreement.id,
                AgreementDrivePermission.revoked_at.is_(None),
            )).all()
        ]

    def direct_for_email(email: str) -> dict | None:
        normalized = _canonical_email(email)
        for permission in current:
            if permission.get("type") != "user" or not permission.get("emailAddress"):
                continue
            if _canonical_email(permission["emailAddress"]) != normalized:
                continue
            if _is_inherited_permission(permission):
                continue
            return permission
        return None

    result = {
        "status": target_status,
        "added": [],
        "adopted": [],
        "upgraded": [],
        "removed": [],
        "unchanged": [],
        "inherited_permissions_present": any(_is_inherited_permission(permission) for permission in current),
        "inherited_access_retained": [],
        "needs_repair": False,
    }

    # Permission ids the policy wants on the Doc.  Matching by id (not by the
    # email we typed) means an address Google normalises differently — case,
    # Gmail dots, googlemail.com — is still recognised as the same person.
    keep_ids: set[str] = set()
    same_status = target_status == agreement.status
    grant_errors: list[str] = []

    # Add/adopt first.  This ordering guarantees that a failed hand-off never
    # removes the only active participant who can continue the workflow.
    for item in desired:
        role = item["role"]
        email = item["email"].strip()
        key = (role, email.lower())
        permission = direct_for_email(email)
        if permission is None:
            try:
                permission_id = google_drive.grant_permission(
                    doc_id,
                    email,
                    role=item.get("drive_role", "writer"),
                    notify=notify and role == "partner",
                )
            except DriveError as exc:
                if not same_status:
                    raise
                # Re-applying the current status (sweep, deactivation): one
                # address Google refuses must not stop the removals below.
                grant_errors.append(str(exc))
                continue
            existing_permission = next((existing for existing in current if existing.get("id") == permission_id), None)
            if existing_permission is not None:
                # Drive handed back an account we already had (an alias we did not
                # recognise): make sure its role matches the policy.
                wanted_role = item.get("drive_role", "writer")
                if existing_permission.get("role") != wanted_role and not _is_inherited_permission(existing_permission):
                    google_drive.update_permission(doc_id, permission_id, role=wanted_role)
                    existing_permission["role"] = wanted_role
            else:
                current.append({"id": permission_id, "type": "user", "emailAddress": email, "role": item.get("drive_role", "writer")})
            result["added"].append(email)
        else:
            permission_id = permission.get("id")
            expected_drive_role = item.get("drive_role", "writer")
            if permission.get("role") != expected_drive_role and permission_id:
                google_drive.update_permission(doc_id, permission_id, role=expected_drive_role)
                permission["role"] = expected_drive_role
                result["upgraded"].append(email)
            existing_keys = {
                (grant.role, grant.email.strip().lower())
                for grant in _active_grants(db, agreement, role=role)
            }
            if key in existing_keys:
                result["unchanged"].append(email)
            else:
                result["adopted"].append(email)
        if permission_id:
            keep_ids.add(permission_id)

        active = _active_grants(db, agreement, role=role)
        matching = [grant for grant in active if grant.email.strip().lower() == email.lower()]
        if matching:
            matching[0].permission_id = permission_id
            for duplicate in matching[1:]:
                duplicate.revoked_at = utc_now()
        else:
            db.add(AgreementDrivePermission(agreement_id=agreement.id, role=role, email=email, permission_id=permission_id))
        db.flush()

    # Retire local grants the policy no longer wants.  Their Drive permission
    # is removed by the allow-list pass below unless the same person is still
    # needed for another role (same permission id, so it is in keep_ids).
    stale_grants = [
        grant
        for grant in db.scalars(select(AgreementDrivePermission).where(
            AgreementDrivePermission.agreement_id == agreement.id,
            AgreementDrivePermission.revoked_at.is_(None),
        )).all()
        if (grant.role, grant.email.strip().lower()) not in desired_by_key
    ]
    stale_ids = {grant.permission_id for grant in stale_grants}
    for grant in stale_grants:
        grant.revoked_at = utc_now()
    db.flush()

    # Allow-list pass: strip every direct permission the policy did not ask
    # for.  In demo mode every agreement shares one Doc, so only this
    # agreement's own stale grants may be removed there.
    service_account = google_drive.service_account_email()
    demo_shared_doc = bool(settings.google_drive_demo_doc_id)
    revoked_ids: set[str] = set()
    for permission in list(current):
        permission_id = permission.get("id")
        if not permission_id or permission_id in keep_ids:
            continue
        if _is_inherited_permission(permission) or permission.get("role") in PROTECTED_DRIVE_ROLES:
            continue
        email = (permission.get("emailAddress") or "").strip().lower()
        if service_account and email == service_account:
            continue
        if demo_shared_doc and permission_id not in stale_ids:
            continue
        google_drive.revoke_permission(doc_id, permission_id)
        revoked_ids.add(permission_id)
        result["removed"].append(_permission_label(permission))
    current_ids = {permission.get("id") for permission in current}
    for grant in stale_grants:
        if grant.permission_id not in current_ids and grant.email.strip().lower() not in desired_emails:
            # Drive already converged; the local row was stale.
            result["removed"].append(grant.email)

    if live and (revoked_ids or stale_grants):
        # Prove the removal stuck instead of trusting the delete call.
        after = google_drive.list_permissions(doc_id)
        survivors = [
            permission for permission in after
            if permission.get("id") in revoked_ids and not _is_inherited_permission(permission)
        ]
        if survivors:
            raise DriveError(
                "Google Drive still lists access for "
                + ", ".join(sorted(_permission_label(permission) for permission in survivors))
                + " after it was revoked; nothing was changed in Accord 360, please retry"
            )
        removed_emails = {grant.email.strip().lower() for grant in stale_grants} | {
            (permission.get("emailAddress") or "").strip().lower()
            for permission in current if permission.get("id") in revoked_ids
        }
        result["inherited_access_retained"] = sorted(
            email for email in removed_emails - desired_emails - {""}
            if any(
                (permission.get("emailAddress") or "").strip().lower() == email and _is_inherited_permission(permission)
                for permission in after
            )
        )

    if result["removed"]:
        audit(
            db, None, "drive_access_revoked", "agreement", agreement.id,
            old_value=", ".join(result["removed"])[:500], new_value=target_status,
        )
    if grant_errors:
        # Removals above already happened in Drive; report the failed grants
        # so the caller rolls back local bookkeeping and the sweep retries.
        raise DriveError("; ".join(grant_errors))

    result["changed"] = bool(result["added"] or result["removed"] or result["adopted"] or result["upgraded"])
    # A successful reconciliation has already repaired any discrepancy.  The
    # flags describe the post-operation state, not whether work was performed.
    result["needs_repair"] = False
    result["synchronized"] = True
    result["checked_at"] = utc_now().isoformat()
    return result


def reconcile_agreements_for_people(
    db: Session,
    *,
    emails: set[str] | None = None,
    researcher_id: int | None = None,
    partner_id: int | None = None,
    notify: bool = False,
) -> None:
    """Best-effort immediate reconcile after someone is deactivated, changes
    role, or stops being a partner's contact.  Failures are logged, not
    raised; the periodic Drive access sweep retries them."""
    import logging

    normalized = {email.strip().lower() for email in (emails or set()) if email}
    clauses = []
    if researcher_id is not None:
        clauses.append(Agreement.researcher_id == researcher_id)
    if partner_id is not None:
        clauses.append(Agreement.partner_id == partner_id)
    if normalized:
        clauses.append(Agreement.id.in_(
            select(AgreementDrivePermission.agreement_id).where(
                AgreementDrivePermission.revoked_at.is_(None),
                func.lower(AgreementDrivePermission.email).in_(normalized),
            )
        ))
    if not clauses:
        return
    ids = db.scalars(
        select(Agreement.id).where(Agreement.template_copy_doc_id.is_not(None), or_(*clauses))
    ).all()
    for agreement_id in ids:
        try:
            agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id).with_for_update())
            if agreement is None:
                continue
            reconcile_drive_access(db, agreement, notify=notify)
            db.commit()
        except Exception:
            db.rollback()
            logging.getLogger("accord360.drive").exception(
                "Immediate Drive access reconcile failed for agreement %s; the periodic sweep will retry", agreement_id
            )


def inspect_drive_access(db: Session, agreement: Agreement) -> dict:
    """Read-only access health check used by the Linkages repair UI."""
    if not agreement.template_copy_doc_id:
        raise DriveError("Agreement has no Google Drive document to inspect")
    desired = desired_drive_access(db, agreement)
    desired_emails = {item["email"].strip().lower() for item in desired}
    desired_keys = {(item["role"], item["email"].strip().lower()) for item in desired}
    current = google_drive.list_permissions(agreement.template_copy_doc_id)
    direct = {
        (item.get("emailAddress") or "").strip().lower(): item
        for item in current
        if item.get("type") == "user"
        and item.get("emailAddress")
        and not any(detail.get("inherited") for detail in (item.get("permissionDetails") or []))
    }
    missing = sorted(email for email in desired_emails if email not in direct)
    expected_role = "reader" if agreement.status in DRIVE_READ_ONLY_STATUSES else "writer"
    wrong_role = sorted(email for email in desired_emails if email in direct and direct[email].get("role") != expected_role)
    active = list(db.scalars(select(AgreementDrivePermission).where(
        AgreementDrivePermission.agreement_id == agreement.id,
        AgreementDrivePermission.revoked_at.is_(None),
    )).all())
    managed_keys = {(grant.role, grant.email.strip().lower()) for grant in active}
    stale = sorted({grant.email.strip().lower() for grant in active if (grant.role, grant.email.strip().lower()) not in desired_keys})
    unrecorded = sorted(email for email in desired_emails if email in direct and not any(
        (item["role"], email) in managed_keys for item in desired if item["email"].strip().lower() == email
    ))
    inherited = any(
        any(detail.get("inherited") for detail in (item.get("permissionDetails") or []))
        for item in current
    )
    # Direct access nobody in the workflow granted: hand-added shares,
    # link sharing, domain sharing. Reconcile removes all of these.
    service_account = google_drive.service_account_email()
    unauthorized = sorted(
        _permission_label(item)
        for item in current
        if not _is_inherited_permission(item)
        and item.get("role") not in PROTECTED_DRIVE_ROLES
        and (item.get("emailAddress") or "").strip().lower() not in desired_emails | {service_account or ""}
    )
    return {
        "status": agreement.status,
        "synchronized": not (missing or wrong_role or stale or unauthorized),
        "needs_repair": bool(missing or wrong_role or stale or unrecorded or unauthorized),
        "unauthorized": unauthorized,
        "inherited_permissions_present": inherited,
        "missing": missing,
        "wrong_role": wrong_role,
        "stale": stale,
        "unrecorded": unrecorded,
        "checked_at": utc_now().isoformat(),
    }


def _apply_drive_side_effects(db: Session, agreement: Agreement, action: str, actor: User, comment: str | None = None) -> None:
    """Apply Drive permission changes only; workflow handoffs are in-app."""

    try:
        if action == "submit":
            # Cut the external partner off immediately, then bring in Linkages.
            _revoke_drive_access(db, agreement, role="partner")
            _grant_staff(db, agreement, "linkages")
        elif action == "send_to_legal":
            _grant_staff(db, agreement, "legal")
        elif action == "return_to_linkages":
            _revoke_drive_access(db, agreement, role="legal")
        elif action == "approve":
            _revoke_drive_access(db, agreement, role="legal")
        elif action in {"return_to_researcher", "resubmit"}:
            # No Drive permission change; the workflow handoff is in-app.
            pass
    except DriveError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def scoped_query(user: User):
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.researcher),
    )
    return apply_agreement_scope(stmt, user)


def list_agreements(
    db: Session,
    user: User,
    *,
    search: str | None,
    status_filter: str | None,
    department: str | None,
):
    stmt = scoped_query(user)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Agreement.title.ilike(pattern),
                Agreement.partner.has(Partner.name.ilike(pattern)),
            )
        )
    if status_filter:
        statuses = [item.strip() for item in status_filter.split(",") if item.strip()]
        stmt = stmt.where(Agreement.status.in_(statuses)) if len(statuses) > 1 else stmt.where(Agreement.status == statuses[0])
    if department:
        stmt = stmt.where(Agreement.department == department)
    return db.scalars(stmt.order_by(Agreement.updated_at.desc())).all()


def create_agreement(db: Session, user: User, payload: AgreementCreate, request: Request) -> AgreementDetailOut:
    # Researcher self-initiates (REBUILD_BRIEF.md Section 2.1 / 5.3) — no
    # code path lets another role create an agreement on a Researcher's behalf.
    if user.role != "researcher":
        raise HTTPException(status_code=403, detail="Only Researchers can create collaboration requests")
    partner = db.get(Partner, payload.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after the start date")

    template = db.scalar(
        select(Template).where(
            Template.document_type == payload.document_type,
            Template.is_active.is_(True),
        )
    )
    if not template:
        raise HTTPException(status_code=400, detail=f"No active template exists for {payload.document_type}")
    if not template.master_doc_id:
        raise HTTPException(status_code=400, detail="The active template is not linked to a Google Doc")
    if not partner.contact_email:
        raise HTTPException(status_code=400, detail="The selected partner has no contact email on file")

    # Structured intake fields still gate Submit (spec Section 4's "trust-based
    # confirmation") even though they're no longer merged into a document —
    # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5.1.
    definitions = template_service.list_field_definitions(db)
    known_fields = {item.field_name for item in definitions}
    unknown_fields = sorted(set(payload.field_values) - known_fields)
    if unknown_fields:
        raise HTTPException(status_code=400, detail=f"Unknown form fields: {', '.join(unknown_fields)}")
    values = {key: str(value) for key, value in payload.field_values.items() if value is not None}
    # These duplicate what AgreementCreate already captures directly
    # (title/department/dates/partner/researcher) — auto-fill them so a
    # FieldDefinition of the same name doesn't force the caller to retype
    # data the form already collected elsewhere.
    values.setdefault("partner_name", partner.name)
    values.setdefault("agreement_title", payload.title)
    values.setdefault("department", payload.department)
    values.setdefault("start_date", payload.start_date.isoformat())
    values.setdefault("end_date", payload.end_date.isoformat())
    values.setdefault("researcher_name", user.full_name)
    missing = sorted(item.field_name for item in definitions if item.required and not str(values.get(item.field_name, "")).strip())
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required form fields: {', '.join(missing)}")

    agreement = Agreement(
        title=payload.title,
        department=payload.department,
        partner_id=payload.partner_id,
        researcher_id=user.id,
        status="draft_generated",
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(agreement)
    db.flush()

    # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5.1: copy the master template via
    # the Drive API (the master itself is never touched) and grant the
    # researcher + the external partner writer access on the copy. No
    # AgreementVersion is created here — drafting-stage content lives only in
    # the live Google Doc; Accord 360 stores just the access grants below.
    doc_id: str | None = None
    try:
        doc_id = google_drive.copy_template(template.master_doc_id, name=f"{payload.title} — {partner.name}")
        agreement.template_copy_doc_id = doc_id
        agreement.template_copy_url = google_drive.doc_url(doc_id)
        reconcile_drive_access(db, agreement, target_status="draft_generated")
    except DriveError as exc:
        if doc_id:
            try:
                google_drive.trash_file(doc_id)
            except DriveError:
                # Preserve the original error; the cleanup failure is logged
                # by the wrapper so an operator can remove the orphaned copy.
                pass
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    audit(db, user, "create_agreement", "agreement", agreement.id, request, new_value=agreement.title)
    # Linkages is deliberately NOT notified here — only once the Researcher
    # explicitly hits Submit (the new "submit" transition) after the partner
    # has finished editing. See GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5.1 step 6.
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def get_agreement_detail(db: Session, user: User, agreement_id: int) -> AgreementDetailOut:
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id).options(*LOAD_OPTIONS))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    # Conceal out-of-scope records on direct reads. Mutating endpoints retain
    # their explicit 403 responses so callers can distinguish read-only access
    # from an authorization failure when attempting a change.
    from ...access import can_view_agreement

    if not can_view_agreement(user, agreement):
        raise HTTPException(status_code=404, detail="Agreement not found")
    result = AgreementDetailOut.model_validate(agreement)
    actions = available_actions(user, agreement)
    # Only Linkages acts on the "changed after approval" check, so only their
    # page load pays for the live Drive call.
    if user.role == "linkages":
        result.doc_modified_after_approval = _doc_changed_since_approval(agreement)
    if agreement.status in SEND_BACK_TO_LEGAL_STATUSES and result.doc_modified_after_approval is not True:
        actions = [item for item in actions if item != "send_to_legal"]
    result.available_actions = actions
    return result


def update_agreement(db: Session, user: User, agreement_id: int, payload: AgreementUpdate, request: Request) -> AgreementDetailOut:
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_edit_agreement(user, agreement)

    changes = payload.model_dump(exclude_unset=True)
    if user.role == "researcher":
        disallowed = set(changes) - RESEARCHER_EDIT_FIELDS
        if disallowed:
            raise HTTPException(status_code=403, detail=f"Researchers cannot update: {', '.join(sorted(disallowed))}")

    start_date = changes.get("start_date", agreement.start_date)
    end_date = changes.get("end_date", agreement.end_date)
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after the start date")

    old_title = agreement.title
    for key, value in changes.items():
        setattr(agreement, key, value)
    audit(db, user, "update_agreement", "agreement", agreement.id, request, old_value=old_title, new_value=agreement.title)
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def transition_agreement(db: Session, user: User, agreement_id: int, payload: TransitionRequest, request: Request) -> AgreementDetailOut:
    # Serialize workflow mutations for the same agreement on databases that
    # support row-level locks. SQLite (used by the prototype/tests) safely
    # degrades this to its normal transaction locking.
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id).with_for_update())
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)

    key = (agreement.status, payload.action)
    transition = TRANSITIONS.get(key)
    if not transition:
        raise HTTPException(
            status_code=400,
            detail=f"Action '{payload.action}' is not valid while the agreement is '{agreement.status}'",
        )
    to_status, allowed_roles = transition
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role '{user.role}' cannot perform '{payload.action}'")
    if payload.action == "mark_fully_executed":
        raise HTTPException(status_code=409, detail="Upload the final signed scan to complete execution")
    if payload.action in {"submit", "resubmit"} and agreement.researcher_id != user.id:
        raise HTTPException(status_code=403, detail="Only the agreement's Researcher can submit it")

    if payload.action == "start_signing" and agreement.template_copy_doc_id:
        _ensure_signing_copy_unchanged(agreement)
    sending_back_to_legal = payload.action == "send_to_legal" and agreement.status in SEND_BACK_TO_LEGAL_STATUSES
    if sending_back_to_legal and _doc_changed_since_approval(agreement) is not True:
        raise HTTPException(
            status_code=409,
            detail="The Google Doc has not changed since Legal approval, so it does not need another Legal review.",
        )

    from_status = agreement.status
    # Reconcile Drive before changing local status. If Drive fails, the
    # exception leaves the status untouched and the action can be retried.
    if agreement.template_copy_doc_id:
        try:
            reconcile_drive_access(db, agreement, target_status=to_status)
        except DriveError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    if payload.action == "approve":
        agreement.approved_at = utc_now()
        agreement.approved_by_name = user.full_name
        # Snapshot the file-level modifiedTime (taken after the reconcile above);
        # later checks compare the newest *content* revision against it.
        agreement.approved_doc_modified_at = (
            google_drive.get_file_modified_time(agreement.template_copy_doc_id) if agreement.template_copy_doc_id else None
        )
    if sending_back_to_legal:
        # The old approval no longer covers the Doc; Legal must approve again.
        agreement.approved_at = None
        agreement.approved_by_name = None
        agreement.approved_doc_modified_at = None
    agreement.status = to_status
    if to_status == "archived":
        agreement.archived = True

    db.add(
        WorkflowEvent(
            agreement_id=agreement.id,
            from_stage=from_status,
            to_stage=to_status,
            action=payload.action,
            comment=(payload.comment or "").strip() or None,
            actor_id=user.id,
        )
    )
    audit(db, user, f"transition_{payload.action}", "agreement", agreement.id, request, old_value=from_status, new_value=to_status)

    event_by_action = {
        "submit": ("agreement.submitted", "Agreement submitted for Linkages review", "action_required", "info", True, {"linkages"}),
        "send_to_legal": ("agreement.sent_to_legal", "Legal review required", "action_required", "info", True, {"legal"}),
        "return_to_linkages": ("agreement.returned_to_linkages", "Agreement returned to Linkages", "action_required", "warning", True, {"linkages"}),
        "return_to_researcher": ("agreement.returned_to_researcher", "Agreement returned for corrections", "action_required", "warning", True, set()),
        "resubmit": ("agreement.resubmitted", "Agreement resubmitted for Linkages review", "action_required", "info", True, {"linkages"}),
        "approve": ("agreement.approved", "Agreement approved — begin signing", "action_required", "success", True, {"linkages"}),
        "start_signing": ("agreement.signing_started", "Signing has started", "status_update", "info", False, set()),
        "renew": ("agreement.renewed", "Agreement renewed", "status_update", "success", False, {"linkages"}),
        "archive": ("agreement.archived", "Agreement archived", "status_update", "info", False, {"me"}),
    }
    event_type, title, category, severity, requires_action, roles = event_by_action[payload.action]
    message = f"{agreement.title}: {user.full_name} completed '{payload.action.replace('_', ' ')}'."
    if requires_action:
        message += " Open the agreement and complete the next review step."
    if payload.action == "return_to_researcher":
        notify_user(db, agreement.researcher, title, message, agreement.id, severity,
                    event_type=event_type, category=category, severity=severity, actor=user,
                    requires_action=True, dedupe_key=f"{event_type}:{agreement.id}")
    elif payload.action == "start_signing":
        notify_user(db, agreement.researcher, title, message, agreement.id, severity,
                    event_type=event_type, category=category, severity=severity, actor=user,
                    requires_action=False, dedupe_key=f"{event_type}:{agreement.id}")
    elif payload.action == "archive":
        for recipient in db.scalars(select(User).where(User.role == "me", User.is_active.is_(True), User.id != user.id)).all():
            notify_user(db, recipient, title, message, agreement.id, severity,
                        event_type=event_type, category=category, severity=severity, actor=user,
                        requires_action=False, dedupe_key=f"{event_type}:{agreement.id}:{recipient.id}")
    else:
        notify_roles(db, roles, title, message, agreement.id, severity,
                     event_type=event_type, category=category, severity=severity, actor=user,
                     requires_action=requires_action, dedupe_key=f"{event_type}:{agreement.id}")
    # Completing a transition resolves the prior open task for this agreement.
    resolve_notifications(
        db, agreement_id=agreement.id,
        event_types={
            "agreement.submitted", "agreement.sent_to_legal", "agreement.returned_to_linkages",
            "agreement.returned_to_researcher", "agreement.resubmitted", "agreement.approved",
        } - {event_type},
    )
    db.commit()
    return get_agreement_detail(db, user, agreement.id)


def _ensure_signing_copy_unchanged(agreement: Agreement) -> None:
    """Require a readable Drive approval snapshot before signing can begin."""
    if not agreement.approved_doc_modified_at:
        raise HTTPException(status_code=409, detail="Legal approval timestamp is unavailable; send this agreement through Legal review again before signing.")
    current = google_drive.get_modified_time(agreement.template_copy_doc_id)
    if not current:
        raise HTTPException(status_code=502, detail="Could not verify the Google Doc after Legal approval. Please retry.")
    if current > agreement.approved_doc_modified_at:
        raise HTTPException(status_code=409, detail="The Google Doc changed after Legal approval. Send it through Legal review again before signing.")


def add_agreement_version(
    db: Session,
    agreement: Agreement,
    *,
    file: str,
    uploaded_by: User,
    is_final: bool = False,
    original_filename: str | None = None,
    content_type: str | None = None,
    file_size: int | None = None,
) -> AgreementVersion:
    """Create a new AgreementVersion, enforcing the two Section 2.6 invariants:

    1. At most one AgreementVersion per Agreement has is_final=true.
    2. Once an Agreement has a final version, no further AgreementVersion can
       be created for it.

    This is a data-layer building block for Phase 2/3's re-upload / signing
    endpoints; it is not itself exposed over HTTP in Phase 1.
    """
    existing_final = db.scalar(
        select(AgreementVersion).where(AgreementVersion.agreement_id == agreement.id, AgreementVersion.is_final.is_(True))
    )
    if existing_final is not None:
        raise ValueError("This agreement already has a final version; no further versions can be created")

    version = AgreementVersion(
        agreement_id=agreement.id,
        file=file,
        original_filename=original_filename,
        content_type=content_type,
        file_size=file_size,
        uploaded_by_id=uploaded_by.id,
        status_at_time=agreement.status,
        is_final=is_final,
    )
    db.add(version)
    db.flush()
    return version


def upload_final_signed_document(
    db: Session,
    user: User,
    agreement_id: int,
    content: bytes,
    original_name: str | None,
    request: Request,
    content_type: str | None = None,
) -> AgreementDetailOut:
    """Store the physically-signed scan Linkages uploads after signing.

    GOOGLE_DOCS_DRAFTING_BRIEF.md Section 5.5: this is the ONLY point in the
    agreement's lifecycle where Accord 360 stores a real file — everything
    before this stays a live Google Doc link. Formerly named
    `upload_initial_draft`; it also used to cover the draft_generated and
    returned_for_corrections edges, which are now pure status transitions
    (Sections 5.2/5.4) with no file upload at all.
    """
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)
    if user.role != "linkages":
        raise HTTPException(status_code=403, detail="Only Linkages can upload the final signed document")
    if agreement.status != "awaiting_signatures":
        raise HTTPException(status_code=409, detail="This agreement is not awaiting a signed document upload")
    if not content:
        raise HTTPException(status_code=400, detail="The signed agreement file is required")
    if len(content) > MAX_SIGNED_FILE_SIZE:
        raise HTTPException(status_code=413, detail="The signed agreement file must be 25 MiB or smaller")

    safe_original = Path(original_name or "").name.strip() or "signed-agreement.pdf"
    suffix = Path(safe_original).suffix.lower()
    if suffix not in {".pdf", ".docx"}:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX signed agreements are accepted")
    if suffix == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="The uploaded PDF is not a valid PDF file")
        expected_type = PDF_MIME
    else:
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    raise ValueError
        except (zipfile.BadZipFile, ValueError):
            raise HTTPException(status_code=400, detail="The uploaded DOCX is not a valid Word document") from None
        expected_type = DOCX_MIME
    supplied_type = (content_type or "").split(";", 1)[0].strip().lower()
    if supplied_type and supplied_type not in {expected_type, "application/octet-stream", "binary/octet-stream"}:
        raise HTTPException(status_code=400, detail="The uploaded file type does not match its extension")

    stored_name = f"agreement-versions/{uuid4().hex}{suffix}"
    target = settings.upload_path / stored_name
    try:
        if settings.storage_enabled:
            storage.upload_file(BytesIO(content), stored_name, expected_type)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not store the signed agreement file; please retry") from exc

    from_status = agreement.status
    try:
        add_agreement_version(
            db, agreement, file=stored_name, uploaded_by=user, is_final=True,
            original_filename=safe_original[:255], content_type=expected_type, file_size=len(content),
        )
    except ValueError:
        db.rollback()
        try:
            if settings.storage_enabled:
                storage.delete_file(stored_name)
            elif target.exists():
                target.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=409, detail="This agreement already has a final signed document")
    except SQLAlchemyError as exc:
        db.rollback()
        try:
            if settings.storage_enabled:
                storage.delete_file(stored_name)
            elif target.exists():
                target.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="The signed agreement could not be recorded") from exc
    agreement.status = "fully_executed"
    # This is the only runtime write site for expiry_alert_date. Renewal
    # semantics remain the explicit Phase 1 TODO and are not inferred here.
    agreement.expiry_alert_date = agreement.end_date - relativedelta(months=6)
    agreement.expiry_notified = False
    db.add(
        WorkflowEvent(
            agreement_id=agreement.id,
            from_stage=from_status,
            to_stage=agreement.status,
            action="upload_final_signed_scan",
            comment="Linkages uploaded the final signed scan.",
            actor_id=user.id,
        )
    )
    audit(db, user, "upload_final_signed_document", "agreement", agreement.id, request, old_value=from_status, new_value=agreement.status)
    notification_title = "Agreement fully executed"
    notification_message = f"{agreement.title}: {user.full_name} uploaded the final signed scan."
    notify_roles(
        db, {"legal", "me"}, notification_title, notification_message, agreement.id, "success",
        event_type="agreement.fully_executed", category="status_update", severity="success", actor=user,
        requires_action=False, dedupe_key=f"agreement.fully_executed:{agreement.id}",
    )
    researcher = db.get(User, agreement.researcher_id)
    if researcher:
        notify_user(db, researcher, notification_title, notification_message, agreement.id, "success",
                    event_type="agreement.fully_executed", category="status_update", severity="success", actor=user,
                    requires_action=False, dedupe_key=f"agreement.fully_executed:{agreement.id}:researcher")
    resolve_notifications(db, agreement_id=agreement.id, event_types={"agreement.signing_started", "agreement.approved"})
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        try:
            if settings.storage_enabled:
                storage.delete_file(stored_name)
            elif target.exists():
                target.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="The signed agreement could not be recorded") from exc
    if agreement.template_copy_doc_id:
        # The executed Doc is read-only for everyone still on it. The signed
        # scan is already stored, so a Drive hiccup is logged and left to the
        # periodic access sweep rather than failing the upload.
        try:
            reconcile_drive_access(db, agreement, notify=False)
            db.commit()
        except Exception:
            db.rollback()
            import logging
            logging.getLogger("accord360.drive").exception(
                "Drive access reconcile after final scan failed for agreement %s; the sweep will retry", agreement.id
            )
    return get_agreement_detail(db, user, agreement.id)


def export_signing_copy(db: Session, user: User, agreement_id: int, output_format: str) -> tuple[bytes, str, str]:
    """Export the unchanged, Legal-approved Google Doc for physical signing."""
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ensure_can_view_agreement(user, agreement)
    if user.role != "linkages":
        raise HTTPException(status_code=403, detail="Only Linkages can export the signing copy")
    if agreement.status not in {"approved_for_signing", "awaiting_signatures"}:
        raise HTTPException(status_code=409, detail="A signing copy is only available after Legal approval")
    if not agreement.template_copy_doc_id:
        raise HTTPException(status_code=409, detail="This agreement has no linked Google Doc")
    _ensure_signing_copy_unchanged(agreement)
    export_spec = SIGNING_EXPORTS.get(output_format.lower())
    if not export_spec:
        raise HTTPException(status_code=400, detail="format must be pdf or docx")
    mime_type, suffix = export_spec
    try:
        payload = google_drive.export_file(agreement.template_copy_doc_id, mime_type)
    except DriveError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", agreement.title).strip("-._") or "agreement"
    return payload, mime_type, f"{name}-signing-copy{suffix}"




def create_progress_update(db: Session, user: User, agreement_id: int, payload: ProgressUpdateCreate, request: Request) -> ProgressUpdate:
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if user.role != "researcher" or agreement.researcher_id != user.id:
        raise HTTPException(status_code=403, detail="Only the agreement's Researcher can submit progress updates")
    if agreement.status not in {"fully_executed", "expired"}:
        raise HTTPException(status_code=400, detail="Progress updates are allowed only for fully executed or expired agreements")
    update = ProgressUpdate(
        agreement_id=agreement_id,
        quarter=payload.quarter,
        notes=payload.notes.strip(),
        submitted_by_id=user.id,
    )
    db.add(update)
    db.flush()
    audit(db, user, "create_progress_update", "progress_update", update.id, request, new_value=update.quarter)
    db.commit()
    db.refresh(update)
    return update


def list_progress_updates(db: Session, user: User, agreement_id: int | None = None) -> list[ProgressUpdate]:
    if user.role != "me":
        raise HTTPException(status_code=403, detail="Only M&E can list all progress updates")
    statement = select(ProgressUpdate).options(selectinload(ProgressUpdate.submitted_by)).order_by(ProgressUpdate.created_at.desc())
    if agreement_id is not None:
        statement = statement.where(ProgressUpdate.agreement_id == agreement_id)
    return db.scalars(statement).all()


def get_agreement_for_version(db: Session, user: User, agreement_id: int, version_id: int) -> AgreementVersion:
    version = db.scalar(
        select(AgreementVersion)
        .join(Agreement, Agreement.id == AgreementVersion.agreement_id)
        .where(AgreementVersion.id == version_id, AgreementVersion.agreement_id == agreement_id)
    )
    if not version:
        raise HTTPException(status_code=404, detail="Agreement version not found")
    ensure_can_view_agreement(user, version.agreement)
    return version
