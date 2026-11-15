from __future__ import annotations

import csv
import io
from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ...access import apply_agreement_scope
from ...db.session import get_db
from ...deps import audit, get_current_user, require_roles
from ...models import Agreement, AuditLog, Partner, User
from ...schemas import AuditLogOut
from ...timeutils import utc_now

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportFilters(BaseModel):
    status: str | None = None
    department: str | None = None
    partner_sector: str | None = None
    expiry_from: date | None = None
    expiry_to: date | None = None


def _scoped_rows(db: Session, user: User, filters: ReportFilters) -> list[Agreement]:
    stmt = select(Agreement).options(selectinload(Agreement.partner), selectinload(Agreement.researcher))
    stmt = apply_agreement_scope(stmt, user)
    if filters.status:
        stmt = stmt.where(Agreement.status == filters.status)
    if filters.department:
        stmt = stmt.where(Agreement.department == filters.department)
    if filters.partner_sector:
        stmt = stmt.where(Agreement.partner.has(Partner.sector == filters.partner_sector))
    if filters.expiry_from:
        stmt = stmt.where(Agreement.end_date >= filters.expiry_from)
    if filters.expiry_to:
        stmt = stmt.where(Agreement.end_date <= filters.expiry_to)
    return db.scalars(stmt.order_by(Agreement.title)).all()


def _portfolio(rows: list[Agreement]) -> dict:
    return {
        "totals": {
            "total_agreements": len(rows),
            "fully_executed": sum(1 for item in rows if item.status == "fully_executed"),
            "expired": sum(1 for item in rows if item.status == "expired"),
            "archived": sum(1 for item in rows if item.status == "archived"),
        },
        "by_status": [{"name": name, "value": value} for name, value in sorted(Counter(item.status for item in rows).items())],
        "by_department": [{"name": name, "value": value} for name, value in sorted(Counter(item.department for item in rows).items())],
        "by_sector": [{"name": name, "value": value} for name, value in sorted(Counter(item.partner.sector for item in rows).items())],
        "records": [
            {
                "id": item.id,
                "title": item.title,
                "partner": item.partner.name,
                "sector": item.partner.sector,
                "department": item.department,
                "researcher": item.researcher.full_name,
                "status": item.status,
                "start_date": item.start_date.isoformat() if item.start_date else None,
                "end_date": item.end_date.isoformat() if item.end_date else None,
                "days_to_expiry": item.days_to_expiry,
            }
            for item in rows
        ],
    }


def _query_filters(
    status_filter: str | None,
    department: str | None,
    partner_sector: str | None,
    expiry_from: date | None,
    expiry_to: date | None,
) -> ReportFilters:
    return ReportFilters(
        status=status_filter,
        department=department,
        partner_sector=partner_sector,
        expiry_from=expiry_from,
        expiry_to=expiry_to,
    )


@router.get("/portfolio")
def portfolio_report(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    department: str | None = None,
    partner_sector: str | None = None,
    expiry_from: date | None = None,
    expiry_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    filters = _query_filters(status_filter, department, partner_sector, expiry_from, expiry_to)
    result = _portfolio(_scoped_rows(db, user, filters))
    audit(db, user, "view_portfolio_report", "report", "portfolio", request, new_value=f"rows={len(result['records'])}")
    db.commit()
    return result


@router.get("/agreements.csv")
def export_agreements(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    department: str | None = None,
    partner_sector: str | None = None,
    expiry_from: date | None = None,
    expiry_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    filters = _query_filters(status_filter, department, partner_sector, expiry_from, expiry_to)
    rows = _scoped_rows(db, user, filters)
    generated_at = utc_now()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Accord360 Agreement Export"])
    writer.writerow(["Generated at (UTC)", generated_at.isoformat(timespec="seconds")])
    writer.writerow([])
    writer.writerow(["Title", "Partner", "Sector", "Department", "Researcher", "Status", "Start Date", "End Date", "Days to Expiry"])
    for item in rows:
        writer.writerow([
            item.title,
            item.partner.name,
            item.partner.sector,
            item.department,
            item.researcher.full_name,
            item.status,
            item.start_date or "",
            item.end_date or "",
            item.days_to_expiry if item.days_to_expiry is not None else "",
        ])
    audit(db, user, "export_agreements", "report", "agreements.csv", request, new_value=f"rows={len(rows)}")
    db.commit()
    output.seek(0)
    filename = f"accord360-agreements-{generated_at:%Y%m%d-%H%M%S}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/audit", response_model=list[AuditLogOut])
def audit_report(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("linkages")),
):
    return db.scalars(select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(limit)).all()
