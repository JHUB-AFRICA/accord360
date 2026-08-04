from __future__ import annotations

import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ...access import apply_agreement_scope
from ...db.session import get_db
from ...deps import audit, get_current_user, require_roles
from ...models import Agreement, AuditLog, Partner, User
from ...schemas import AuditLogOut
from ...timeutils import utc_now

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/agreements.csv")
def export_agreements(
    request: Request,
    stage: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    agreement_type: str | None = None,
    department: str | None = None,
    partner_sector: str | None = None,
    expiry_from: date | None = None,
    expiry_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.owner),
    )
    stmt = apply_agreement_scope(stmt, user)
    if stage:
        stmt = stmt.where(Agreement.stage == stage)
    if status_filter:
        stmt = stmt.where(Agreement.status == status_filter)
    if agreement_type:
        stmt = stmt.where(Agreement.agreement_type == agreement_type)
    if department:
        stmt = stmt.where(Agreement.department == department)
    if partner_sector:
        stmt = stmt.where(Agreement.partner.has(Partner.sector == partner_sector))
    if expiry_from:
        stmt = stmt.where(Agreement.expiry_date >= expiry_from)
    if expiry_to:
        stmt = stmt.where(Agreement.expiry_date <= expiry_to)

    rows = db.scalars(stmt.order_by(Agreement.reference_number)).all()
    generated_at = utc_now()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Accord360 Agreement Export"])
    writer.writerow(["Generated at (UTC)", generated_at.isoformat(timespec="seconds")])
    writer.writerow(["Applied filters", f"stage={stage or '*'}; status={status_filter or '*'}; type={agreement_type or '*'}; department={department or '*'}; sector={partner_sector or '*'}; expiry_from={expiry_from or '*'}; expiry_to={expiry_to or '*'}"])
    writer.writerow([])
    writer.writerow(["Reference", "Title", "Type", "Partner", "Sector", "Department", "Owner", "Stage", "Status", "Status Color", "Next Action", "Effective Date", "Expiry Date", "Days to Expiry", "Legal Review Days"])
    for item in rows:
        writer.writerow([
            item.reference_number,
            item.title,
            item.agreement_type,
            item.partner.name,
            item.partner.sector,
            item.department,
            item.owner.full_name,
            item.stage,
            item.status,
            item.status_color,
            item.next_action or "",
            item.effective_date or "",
            item.expiry_date or "",
            item.days_to_expiry if item.days_to_expiry is not None else "",
            item.legal_review_days if item.legal_review_days is not None else "",
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
    _: User = Depends(require_roles("admin", "auditor", "executive", "director_linkages")),
):
    return db.scalars(select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(limit)).all()

