from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_roles
from ..models import Agreement, Document, User

router = APIRouter(prefix="/monitoring", tags=["Monitoring and Evaluation"])


@router.get("/portfolio")
def portfolio(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "linkages", "me", "executive", "auditor")),
):
    agreements = db.scalars(
        select(Agreement)
        .where(Agreement.stage == "active")
        .options(
            selectinload(Agreement.partner),
            selectinload(Agreement.deliverables),
            selectinload(Agreement.documents),
        )
        .order_by(Agreement.updated_at.desc())
    ).all()

    today = date.today()
    rows = []
    for agreement in agreements:
        target = sum(float(item.target_value or 0) for item in agreement.deliverables)
        actual = sum(float(item.actual_value or 0) for item in agreement.deliverables)
        attainment = round((actual / target) * 100, 1) if target else 0
        evidence_count = sum(1 for doc in agreement.documents if doc.document_type == "evidence")
        last_update = max((item.last_updated_at for item in agreement.deliverables), default=agreement.activated_at)
        days_since_update = (today - last_update.date()).days if last_update else None
        rows.append(
            {
                "id": agreement.id,
                "reference_number": agreement.reference_number,
                "title": agreement.title,
                "partner": agreement.partner.name,
                "department": agreement.department,
                "internal_champion": agreement.internal_champion,
                "partner_liaison": agreement.partner_liaison,
                "deliverable_count": len(agreement.deliverables),
                "target_total": target,
                "actual_total": actual,
                "attainment_percent": attainment,
                "evidence_count": evidence_count,
                "last_update": last_update,
                "days_since_update": days_since_update,
                "expiry_date": agreement.expiry_date,
                "expiry_days": agreement.expiry_days,
                "risk_level": "red" if days_since_update is not None and days_since_update >= 180 else agreement.status_color,
            }
        )
    return rows
