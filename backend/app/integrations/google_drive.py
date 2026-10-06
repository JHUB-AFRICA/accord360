"""Google Drive integration — GOOGLE_DOCS_DRAFTING_BRIEF.md Sections 1-3.

Thin wrapper around the Drive API, mirroring how app/utils/storage.py wraps
boto3: no retries, no abstraction beyond what's called. Every function
raises DriveError on failure. The service account (not domain-wide
delegation, per the brief's companion decision) must be shared as Editor on
each master template Doc before copy_template() will work on it.
"""

from __future__ import annotations

import json
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


def grant_permission(doc_id: str, email: str, role: str = "writer", notify: bool = True) -> str:
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
                fields="id",
            )
            .execute()
        )
    except Exception as exc:
        raise DriveError(f"Could not grant {role!r} access on {doc_id!r} to {email!r}") from exc
    permission_id = response.get("id")
    if not permission_id:
        raise DriveError(f"Drive did not return a permission id for {email!r} on {doc_id!r}")
    return permission_id


def revoke_permission(doc_id: str, permission_id: str) -> None:
    try:
        _client().permissions().delete(fileId=doc_id, permissionId=permission_id).execute()
    except Exception as exc:
        raise DriveError(f"Could not revoke permission {permission_id!r} on {doc_id!r}") from exc


def doc_url(doc_id: str) -> str:
    return f"https://docs.google.com/document/d/{doc_id}/edit"
