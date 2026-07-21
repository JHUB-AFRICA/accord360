from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Agreement, AuditLog, User
from ..schemas import AuditLogOut

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/agreements.csv")
def export_agreements(
    stage: str | None = None,
    agreement_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Agreement).options(selectinload(Agreement.partner), selectinload(Agreement.owner))
    if user.role == "researcher":
        stmt = stmt.where(Agreement.owner_id == user.id)
    elif user.role == "approver":
        stmt = stmt.where(or_(Agreement.assigned_approver_id == user.id, Agreement.department == user.department))
    elif user.role == "legal":
        stmt = stmt.where(or_(Agreement.legal_reviewer_id == user.id, Agreement.stage == "legal_review"))
    elif user.role == "me":
        stmt = stmt.where(Agreement.stage == "active")
    stmt = stmt.order_by(Agreement.reference_number)
    if stage:
        stmt = stmt.where(Agreement.stage == stage)
    if agreement_type:
        stmt = stmt.where(Agreement.agreement_type == agreement_type)
    rows = db.scalars(stmt).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Reference", "Title", "Type", "Partner", "Department", "Owner", "Stage", "Status", "Effective Date", "Expiry Date"])
    for item in rows:
        writer.writerow([
            item.reference_number,
            item.title,
            item.agreement_type,
            item.partner.name,
            item.department,
            item.owner.full_name,
            item.stage,
            item.status,
            item.effective_date or "",
            item.expiry_date or "",
        ])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=accord360-agreements.csv"})


@router.get("/audit", response_model=list[AuditLogOut])
def audit_report(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "auditor", "executive")),
):
    return db.scalars(select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(limit)).all()
