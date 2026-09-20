"""Daily stored-date expiry processing for agreements."""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.deps import audit
from app.modules.configuration.models import ConfigurationValue
from app.modules.agreements.models import Agreement
from app.modules.workflows.service import notify_roles

logger = logging.getLogger("accord360.expiry")
LOCK_KEY = "system.expiry_scheduler.last_run"


def run_daily_expiry_check(db: Session | None = None, *, today: date | None = None) -> dict[str, int | bool]:
    """Run the daily expiry pass using only the stored alert/end dates.

    ConfigurationValue is used as the small database-backed last-run lock so
    a second app instance does not send the same daily notifications.
    """
    owns_session = db is None
    session = db or SessionLocal()
    run_date = today or date.today()
    try:
        lock = session.scalar(select(ConfigurationValue).where(ConfigurationValue.key == LOCK_KEY))
        if lock and lock.value == run_date.isoformat():
            logger.info("expiry_check_skipped already_ran=%s", run_date.isoformat())
            return {"ran": False, "approaching": 0, "expired": 0}
        if not lock:
            lock = ConfigurationValue(
                key=LOCK_KEY,
                category="system",
                value=run_date.isoformat(),
                description="Internal lock for the daily agreement expiry check.",
                is_editable=False,
            )
            session.add(lock)
        else:
            lock.value = run_date.isoformat()
        session.flush()

        approaching = session.scalars(
            select(Agreement).where(
                Agreement.expiry_alert_date.is_not(None),
                Agreement.expiry_alert_date <= run_date,
                Agreement.expiry_notified.is_(False),
            )
        ).all()
        for agreement in approaching:
            notify_roles(session, {"me"}, "Agreement approaching expiry", f"{agreement.title} is approaching its expiry date.", agreement.id)
            agreement.expiry_notified = True

        expired = session.scalars(
            select(Agreement).where(
                Agreement.end_date < run_date,
                Agreement.status == "fully_executed",
            )
        ).all()
        for agreement in expired:
            old_status = agreement.status
            agreement.status = "expired"
            audit(session, None, "expire_agreement", "agreement", agreement.id, old_value=old_status, new_value=agreement.status)
            notify_roles(session, {"me"}, "Agreement expired", f"{agreement.title} has expired.", agreement.id)

        session.commit()
        logger.info("expiry_check_complete date=%s approaching=%s expired=%s", run_date.isoformat(), len(approaching), len(expired))
        return {"ran": True, "approaching": len(approaching), "expired": len(expired)}
    except Exception:
        session.rollback()
        logger.exception("expiry_check_failed date=%s", run_date.isoformat())
        raise
    finally:
        if owns_session:
            session.close()
