"""Periodic Google Drive access sweep.

Editors of a Shared Drive file can re-share it from inside Google Docs, and
Google offers no per-file switch to stop that. This job re-applies the
status-driven allow-list (reconcile_drive_access) to every agreement Doc, so
a hand-added share or a removed person who was let back in loses access
within one sweep interval.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.modules.agreements.models import Agreement
from app.modules.agreements.service import reconcile_drive_access

logger = logging.getLogger("accord360.drive")


def run_drive_access_sweep(db: Session | None = None) -> dict[str, int | bool]:
    if not settings.google_drive_enabled:
        return {"ran": False, "checked": 0, "changed": 0, "failed": 0}
    owns_session = db is None
    session = db or SessionLocal()
    checked = changed = failed = 0
    try:
        ids = session.scalars(select(Agreement.id).where(Agreement.template_copy_doc_id.is_not(None))).all()
        for agreement_id in ids:
            try:
                # Same row lock as transition_agreement, so the sweep never
                # applies a stale status over a concurrent hand-off.
                agreement = session.scalar(select(Agreement).where(Agreement.id == agreement_id).with_for_update())
                if agreement is None:
                    session.rollback()
                    continue
                result = reconcile_drive_access(session, agreement, notify=True)
                session.commit()
                checked += 1
                if result["removed"]:
                    changed += 1
                    logger.warning("drive_sweep_revoked agreement=%s removed=%s", agreement_id, result["removed"])
            except Exception:
                session.rollback()
                failed += 1
                logger.exception("drive_sweep_failed agreement=%s", agreement_id)
        logger.info("drive_sweep_complete checked=%s changed=%s failed=%s", checked, changed, failed)
        return {"ran": True, "checked": checked, "changed": changed, "failed": failed}
    finally:
        if owns_session:
            session.close()
