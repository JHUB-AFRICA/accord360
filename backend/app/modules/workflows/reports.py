from __future__ import annotations

import csv
import io
import zipfile
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from html import escape

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response, StreamingResponse
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
    stage: str | None = None
    status: str | None = None
    agreement_type: str | None = None
    department: str | None = None
    partner_sector: str | None = None
    expiry_from: date | None = None
    expiry_to: date | None = None


def _scoped_rows(db: Session, user: User, filters: ReportFilters) -> list[Agreement]:
    stmt = select(Agreement).options(
        selectinload(Agreement.partner),
        selectinload(Agreement.owner),
        selectinload(Agreement.values),
    )
    stmt = apply_agreement_scope(stmt, user)
    if filters.stage:
        stmt = stmt.where(Agreement.stage == filters.stage)
    if filters.status:
        stmt = stmt.where(Agreement.status == filters.status)
    if filters.agreement_type:
        stmt = stmt.where(Agreement.agreement_type == filters.agreement_type)
    if filters.department:
        stmt = stmt.where(Agreement.department == filters.department)
    if filters.partner_sector:
        stmt = stmt.where(Agreement.partner.has(Partner.sector == filters.partner_sector))
    if filters.expiry_from:
        stmt = stmt.where(Agreement.expiry_date >= filters.expiry_from)
    if filters.expiry_to:
        stmt = stmt.where(Agreement.expiry_date <= filters.expiry_to)
    return db.scalars(stmt.order_by(Agreement.reference_number)).all()


def _portfolio(rows: list[Agreement]) -> dict:
    active = [item for item in rows if item.stage == "active" and item.status not in {"expired", "archived", "closed"}]
    pipeline_stages = {"initiation", "department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"}
    pipeline = [item for item in rows if item.stage in pipeline_stages]
    value_by_currency: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for agreement in rows:
        for record in agreement.values:
            if record.approved:
                value_by_currency[record.currency.upper()] += record.amount
    return {
        "totals": {
            "total_partnerships": len(rows),
            "active_agreements": len(active),
            "pipeline": len(pipeline),
            "at_risk": sum(1 for item in rows if item.status_color in {"orange", "red"}),
        },
        "by_stage": [{"name": name, "value": value} for name, value in sorted(Counter(item.stage for item in rows).items())],
        "by_type": [{"name": name, "value": value} for name, value in sorted(Counter(item.agreement_type for item in rows).items())],
        "by_sector": [{"name": name, "value": value} for name, value in sorted(Counter(item.partner.sector for item in rows).items())],
        "by_department": [{"name": name, "value": value} for name, value in sorted(Counter(item.department for item in rows).items())],
        "value_by_currency": [{"currency": key, "amount": float(value)} for key, value in sorted(value_by_currency.items())],
        "records": [
            {
                "id": item.id,
                "reference_number": item.reference_number,
                "title": item.title,
                "agreement_type": item.agreement_type,
                "partner": item.partner.name,
                "sector": item.partner.sector,
                "department": item.department,
                "owner": item.owner.full_name,
                "stage": item.stage,
                "status": item.status,
                "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                "days_to_expiry": item.days_to_expiry,
            }
            for item in rows
        ],
    }


def _narrative(portfolio: dict) -> str:
    totals = portfolio["totals"]
    type_item = max(portfolio["by_type"], key=lambda item: item["value"], default=None)
    stage_item = max(portfolio["by_stage"], key=lambda item: item["value"], default=None)
    return (
        f"The authorized portfolio contains {totals['total_partnerships']} agreement records, "
        f"including {totals['active_agreements']} active partnerships and {totals['pipeline']} records in the pipeline. "
        f"{type_item['name']} is the largest agreement category with {type_item['value']} record(s). "
        f"{stage_item['name']} is the largest workflow stage with {stage_item['value']} record(s). "
        f"{totals['at_risk']} record(s) are flagged at risk. This narrative was generated from the authorized portfolio snapshot and requires human review."
    )


def _pdf_bytes(title: str, lines: list[str]) -> bytes:
    content_lines = [f"BT /F1 16 Tf 50 760 Td ({title}) Tj /F1 9 Tf"]
    for line in lines[:42]:
        content_lines.append(f"0 -16 Td ({line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')[:115]}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    output = io.BytesIO(b"%PDF-1.4\n")
    output.seek(0, io.SEEK_END)
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    output.write(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]))
    output.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return output.getvalue()


def _xlsx_bytes(portfolio: dict) -> bytes:
    headers = ["Reference", "Title", "Type", "Partner", "Sector", "Department", "Owner", "Stage", "Status", "Expiry"]
    rows = [headers] + [[item[key] or "" for key in ["reference_number", "title", "agreement_type", "partner", "sector", "department", "owner", "stage", "status", "expiry_date"]] for item in portfolio["records"]]
    def cell(value: object, column: int) -> str:
        ref = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[column] + "{row}"
        if isinstance(value, (int, float)):
            return f'<c r="{ref}" t="n"><v>{value}</v></c>'
        return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'
    sheet_rows = "".join(f'<row r="{index}">' + "".join(cell(value, column).format(row=index) for column, value in enumerate(row)) + "</row>" for index, row in enumerate(rows, 1))
    files = {
        "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Portfolio" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{sheet_rows}</sheetData></worksheet>',
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return output.getvalue()


def _query_filters(
    stage: str | None,
    status_filter: str | None,
    agreement_type: str | None,
    department: str | None,
    partner_sector: str | None,
    expiry_from: date | None,
    expiry_to: date | None,
) -> ReportFilters:
    return ReportFilters(
        stage=stage,
        status=status_filter,
        agreement_type=agreement_type,
        department=department,
        partner_sector=partner_sector,
        expiry_from=expiry_from,
        expiry_to=expiry_to,
    )


@router.get("/portfolio")
def portfolio_report(
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
    filters = _query_filters(stage, status_filter, agreement_type, department, partner_sector, expiry_from, expiry_to)
    result = _portfolio(_scoped_rows(db, user, filters))
    audit(db, user, "view_portfolio_report", "report", "portfolio", request, new_value=f"rows={len(result['records'])}")
    db.commit()
    return result


@router.get("/export.pdf")
def export_portfolio_pdf(
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
    filters = _query_filters(stage, status_filter, agreement_type, department, partner_sector, expiry_from, expiry_to)
    portfolio = _portfolio(_scoped_rows(db, user, filters))
    audit(db, user, "export_portfolio_pdf", "report", "portfolio.pdf", request, new_value=f"rows={len(portfolio['records'])}")
    db.commit()
    lines = [f"Total agreements: {portfolio['totals']['total_partnerships']}", f"Active partnerships: {portfolio['totals']['active_agreements']}", f"Pipeline: {portfolio['totals']['pipeline']}", f"At risk: {portfolio['totals']['at_risk']}"]
    lines.extend(f"{item['reference_number']} | {item['partner']} | {item['status']}" for item in portfolio["records"])
    generated_at = utc_now()
    return Response(content=_pdf_bytes("Accord360 Portfolio Report", lines), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="accord360-portfolio-{generated_at:%Y%m%d-%H%M%S}.pdf"'})


@router.get("/export.xlsx")
def export_portfolio_xlsx(
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
    filters = _query_filters(stage, status_filter, agreement_type, department, partner_sector, expiry_from, expiry_to)
    portfolio = _portfolio(_scoped_rows(db, user, filters))
    audit(db, user, "export_portfolio_xlsx", "report", "portfolio.xlsx", request, new_value=f"rows={len(portfolio['records'])}")
    db.commit()
    generated_at = utc_now()
    return Response(content=_xlsx_bytes(portfolio), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="accord360-portfolio-{generated_at:%Y%m%d-%H%M%S}.xlsx"'})


@router.post("/ai-summary")
def ai_summary_report(payload: ReportFilters, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    portfolio = _portfolio(_scoped_rows(db, user, payload))
    summary = _narrative(portfolio)
    audit(db, user, "generate_portfolio_summary", "report", "ai-summary", request, new_value=f"rows={len(portfolio['records'])}")
    db.commit()
    return {"summary": summary, "source": "authorized_portfolio_snapshot", "requires_human_review": True, "portfolio": portfolio}


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
