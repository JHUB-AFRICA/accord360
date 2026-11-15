"""Google Drive integration — GOOGLE_DOCS_DRAFTING_BRIEF.md Sections 1-3.

Thin wrapper around the Drive API, mirroring how app/utils/storage.py wraps
boto3: no retries, no abstraction beyond what's called. Every function
raises DriveError on failure. The service account (not domain-wide
delegation, per the brief's companion decision) must be shared as Editor on
each master template Doc before copy_template() will work on it.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache

from app.core.config import settings

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]


class DriveError(RuntimeError):
    """Raised when a Drive API operation cannot be completed."""


@lru_cache(maxsize=1)
def _client():
    if not settings.google_drive_enabled:
        raise DriveError("Google Drive integration is disabled")
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover - dependency wiring only
        raise DriveError("google-api-python-client is not installed") from exc

    # Accepts either the raw JSON string or a path to the key file (local dev).
    raw = (settings.google_service_account_json or "").strip()
    try:
        if not raw.startswith("{"):
            with open(raw, encoding="utf-8") as fh:
                raw = fh.read()
        info = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise DriveError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or a readable key file path") from exc

    try:
        credentials = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
        return build("drive", "v3", credentials=credentials, cache_discovery=False)
    except Exception as exc:  # pragma: no cover - defensive wrapper
        raise DriveError("Could not build the Google Drive client") from exc


def copy_template(master_doc_id: str, name: str) -> str:
    """Copy the master template Doc, returning the new file's id.

    The master is never touched (files.copy never mutates the source).

    Demo trade-off: a bare service account has no Drive storage quota, so
    files.copy fails with storageQuotaExceeded until a real Shared Drive is
    available (GOOGLE_DOCS_DRAFTING_BRIEF.md's open items). If
    GOOGLE_DRIVE_DEMO_DOC_ID is set, skip the copy and reuse that Doc instead
    — sharing/revoking permissions on it below still hits real Drive, so the
    access-grant behavior is genuinely exercised even though every demo
    agreement points at the same underlying Doc. Remove once real copying
    works against a Shared Drive.
    """
    if settings.google_drive_demo_doc_id:
        return settings.google_drive_demo_doc_id
    try:
        body = {"name": name}
        if settings.google_drive_folder_id:
            body["parents"] = [settings.google_drive_folder_id]
        response = _client().files().copy(fileId=master_doc_id, body=body, supportsAllDrives=True).execute()
    except Exception as exc:
        raise DriveError(f"Could not copy template {master_doc_id!r}: {exc}") from exc
    file_id = response.get("id")
    if not file_id:
        raise DriveError(f"Drive did not return a file id when copying template {master_doc_id!r}")
    return file_id


def grant_permission(doc_id: str, email: str, role: str = "writer", notify: bool = True, message: str | None = None) -> str:
    """Grant `email` `role` access to `doc_id`, returning the Drive permission id.

    Callers MUST persist the returned id (AgreementDrivePermission.permission_id)
    — revocation always goes through a stored id, never a permissions.list lookup.
    """
    try:
        response = (
            _client()
            .permissions()
            .create(
                fileId=doc_id,
                body={"type": "user", "role": role, "emailAddress": email},
                sendNotificationEmail=notify,
                # Shown in Google's "shared with you" email; only used when notify is on.
                **({"emailMessage": message} if (notify and message) else {}),
                supportsAllDrives=True,
                fields="id",
            )
            .execute()
        )
    except Exception as exc:
        logging.getLogger("accord360.drive").warning("Drive grant of %s on %s to %s failed: %s", role, doc_id, email, exc)
        if "cannotShareGeneric" in str(exc):
            # Google refuses to share with an address that has blocked or
            # spam-marked the sender — seen live with a Gmail recipient.
            raise DriveError(
                f"Google can't share this document with {email}. They may have blocked or marked Accord 360 "
                "emails as spam — ask them to check their spam folder and blocked senders, then try again."
            ) from exc
        raise DriveError(f"Could not grant {role!r} access on {doc_id!r} to {email!r}: {exc}") from exc
    permission_id = response.get("id")
    if not permission_id:
        raise DriveError(f"Drive did not return a permission id for {email!r} on {doc_id!r}")
    return permission_id


def send_notification(doc_id: str, email: str, message: str, role: str = "writer") -> bool:
    """Email `email` a Google "shared with you" message about `doc_id`.

    Google sends this email every time a share call asks for a notification —
    even when the person already has access, in which case the call is a
    no-op for permissions and just re-sends the email (verified live). That
    makes it the free hand-off email: no SMTP, no access gap. Best-effort:
    a failed email must never roll back or block a workflow transition, so
    this logs and returns False instead of raising.
    """
    try:
        grant_permission(doc_id, email, role=role, notify=True, message=message)
        return True
    except DriveError as exc:
        logging.getLogger("accord360.drive").warning("Hand-off email to %s for doc %s failed: %s", email, doc_id, exc)
        return False


def revoke_permission(doc_id: str, permission_id: str) -> None:
    try:
        _client().permissions().delete(fileId=doc_id, permissionId=permission_id, supportsAllDrives=True).execute()
    except Exception as exc:
        raise DriveError(f"Could not revoke permission {permission_id!r} on {doc_id!r}: {exc}") from exc


def trash_file(doc_id: str) -> None:
    """Move a newly-created copy to Drive trash during failed creation cleanup."""
    try:
        _client().files().update(
            fileId=doc_id,
            body={"trashed": True},
            supportsAllDrives=True,
            fields="id,trashed",
        ).execute()
    except Exception as exc:
        raise DriveError(f"Could not clean up failed document copy {doc_id!r}: {exc}") from exc


def update_permission(doc_id: str, permission_id: str, *, role: str = "writer") -> None:
    """Upgrade an existing direct permission without creating a duplicate."""
    try:
        (
            _client()
            .permissions()
            .update(
                fileId=doc_id,
                permissionId=permission_id,
                body={"role": role},
                supportsAllDrives=True,
                fields="id,role",
            )
            .execute()
        )
    except Exception as exc:
        raise DriveError(f"Could not update permission {permission_id!r} on {doc_id!r}: {exc}") from exc


def list_permissions(doc_id: str) -> list[dict]:
    """Return the current Drive permissions for ``doc_id``.

    The reconciliation layer deliberately reads permissions from Drive before
    changing them.  This makes retries safe when a previous request completed
    in Drive but failed before its local transaction committed.  Permission
    details are included so inherited access can be reported without trying to
    remove it (Drive only allows inherited access to be changed on the parent).
    """
    permissions: list[dict] = []
    page_token: str | None = None
    try:
        while True:
            response = (
                _client()
                .permissions()
                .list(
                    fileId=doc_id,
                    supportsAllDrives=True,
                    fields="nextPageToken,permissions(id,type,emailAddress,role,permissionDetails(inherited,inheritedFrom))",
                    pageSize=100,
                    **({"pageToken": page_token} if page_token else {}),
                )
                .execute()
            )
            permissions.extend(response.get("permissions") or [])
            page_token = response.get("nextPageToken")
            if not page_token:
                return permissions
    except Exception as exc:
        raise DriveError(f"Could not list permissions on {doc_id!r}: {exc}") from exc


def doc_url(doc_id: str) -> str:
    return f"https://docs.google.com/document/d/{doc_id}/edit"


def get_modified_time(doc_id: str) -> str | None:
    """Drive's `modifiedTime` for the Doc (RFC 3339 string), or None if it
    cannot be read. Used to flag edits made after Legal's approval; callers
    must treat None as "unknown", never as "unchanged".
    """
    try:
        response = _client().files().get(fileId=doc_id, fields="modifiedTime", supportsAllDrives=True).execute()
    except Exception:
        return None
    return response.get("modifiedTime") or None


def export_file(doc_id: str, mime_type: str) -> bytes:
    """Export a native Google Workspace document in the requested format."""
    try:
        payload = _client().files().export(fileId=doc_id, mimeType=mime_type).execute()
    except Exception as exc:
        message = str(exc)
        if "10 MB" in message or "exportSizeLimitExceeded" in message:
            raise DriveError("Google Drive cannot export this signing copy because it exceeds the 10 MiB export limit") from exc
        raise DriveError("Could not export Google document from Drive") from exc
    if not isinstance(payload, (bytes, bytearray)) or not payload:
        raise DriveError("Google Drive returned an empty signing-copy export")
    return bytes(payload)
