from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_roles
from sqlalchemy import select as _select

from ..models import Agreement, Document, MEReportSchedule, User

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
            selectinload(Agreement.owner),
            selectinload(Agreement.deliverables),
            selectinload(Agreement.documents),
        )
        .order_by(Agreement.updated_at.desc())
    ).all()

    today = date.today()
    all_schedules = db.scalars(_select(MEReportSchedule)).all()
    by_agreement: dict[int, list[MEReportSchedule]] = {}
    for sc in all_schedules:
        by_agreement.setdefault(sc.agreement_id, []).append(sc)
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
                "internal_champion": agreement.owner.full_name if agreement.owner else None,
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
                "reports_validated": sum(1 for sc in by_agreement.get(agreement.id, []) if sc.status == "validated"),
                "reports_total": len(by_agreement.get(agreement.id, [])),
                "reports_overdue": sum(1 for sc in by_agreement.get(agreement.id, []) if sc.is_overdue),
                "next_report_due": min((sc.due_date for sc in by_agreement.get(agreement.id, []) if sc.status in {"pending", "returned"}), default=None),
                "risk_level": "red" if days_since_update is not None and days_since_update >= 180 else agreement.status_color,
            }
        )
    return rows
