from __future__ import annotations

import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import Agreement, MEReportSchedule, ScorecardCriterion, User, ValueRecord
from ..schemas import QualitativeScoreUpdate, ScorecardCriterionOut, ScorecardWeightUpdate

router = APIRouter(prefix="/scorecard", tags=["Partnership Scorecard"])

VIEW_ROLES = ("admin", "linkages", "me", "executive", "auditor")


def _grade(total: float) -> str:
    if total >= 80:
        return "A — High performing"
    if total >= 65:
        return "B — Performing"
    if total >= 50:
        return "C — Needs attention"
    return "D — At risk"


def compute_scores(db: Session, agreement: Agreement, schedules: list[MEReportSchedule]) -> dict[str, float]:
    """BR-009: raw 0-100 score per criterion before weighting (Appendix B)."""
    today = date.today()

    # deliverables: attainment against targets
    target = sum(float(d.target_value or 0) for d in agreement.deliverables)
    actual = sum(float(d.actual_value or 0) for d in agreement.deliverables)
    deliverables = min(100.0, (actual / target) * 100) if target else 0.0

    # activity: six-month report compliance for periods due so far
    due_so_far = [s for s in schedules if s.due_date <= today]
    validated = sum(1 for s in due_so_far if s.status == "validated")
    activity = (validated / len(due_so_far)) * 100 if due_so_far else 100.0

    # financial: recency of approved value records
    recent_cutoff = today - timedelta(days=365)
    values = [v for v in agreement.values if v.approved]
    if any(v.created_at.date() >= recent_cutoff for v in values):
        financial = 100.0
    elif values:
        financial = 60.0
    else:
        financial = 0.0

    # strategic alignment documented
    strategic = 100.0 if (agreement.strategic_alignment or "").strip() else 0.0

    # engagement: freshness of M&E updates
    last = max((d.last_updated_at for d in agreement.deliverables), default=agreement.activated_at)
    days = (today - last.date()).days if last else None
    engagement = 100.0 if days is not None and days < 90 else 60.0 if days is not None and days < 180 else 0.0

    # compliance: no overdue reports, not past expiry
    overdue = sum(1 for s in schedules if s.is_overdue)
    expired = agreement.expiry_days is not None and agreement.expiry_days < 0
    compliance = 0.0 if expired else max(0.0, 100.0 - overdue * 50.0)

    qualitative = float(agreement.qualitative_score) if agreement.qualitative_score is not None else 50.0

    return {
        "deliverables": round(deliverables, 1),
        "activity": round(activity, 1),
        "financial": round(financial, 1),
        "strategic": round(strategic, 1),
        "engagement": round(engagement, 1),
        "compliance": round(compliance, 1),
        "qualitative": round(qualitative, 1),
    }


def _portfolio(db: Session) -> tuple[list[ScorecardCriterion], list[dict]]:
    criteria = db.scalars(select(ScorecardCriterion).order_by(ScorecardCriterion.sort_order)).all()
    agreements = db.scalars(
        select(Agreement)
        .where(Agreement.stage == "active")
        .options(selectinload(Agreement.partner), selectinload(Agreement.owner), selectinload(Agreement.deliverables), selectinload(Agreement.values))
        .order_by(Agreement.reference_number)
    ).all()
    schedules = db.scalars(select(MEReportSchedule)).all()
    by_agreement: dict[int, list[MEReportSchedule]] = {}
    for s in schedules:
        by_agreement.setdefault(s.agreement_id, []).append(s)

    rows = []
    for agreement in agreements:
        raw = compute_scores(db, agreement, by_agreement.get(agreement.id, []))
        weighted_total = round(sum(raw[c.key] * c.weight / 100 for c in criteria if c.key in raw), 1)
        rows.append({
            "id": agreement.id,
            "reference_number": agreement.reference_number,
            "title": agreement.title,
            "partner": agreement.partner.name,
            "champion": agreement.owner.full_name,
            "scores": raw,
            "weighted_total": weighted_total,
            "grade": _grade(weighted_total),
            "qualitative_note": agreement.qualitative_note,
        })
    return criteria, rows


@router.get("/config", response_model=list[ScorecardCriterionOut])
def get_config(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(ScorecardCriterion).order_by(ScorecardCriterion.sort_order)).all()


@router.put("/config", response_model=list[ScorecardCriterionOut])
def update_config(
    payload: ScorecardWeightUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
):
    """BR-009: administrators adjust weights; the total must remain 100."""
    criteria = db.scalars(select(ScorecardCriterion)).all()
    known = {c.key for c in criteria}
    if set(payload.weights) != known:
        raise HTTPException(status_code=400, detail=f"Weights must cover exactly these criteria: {', '.join(sorted(known))}")
    old = {c.key: c.weight for c in criteria}
    for criterion in criteria:
        criterion.weight = payload.weights[criterion.key]
    audit(db, actor, "update_scorecard_weights", "scorecard", "config", request, old_value=str(old), new_value=str(payload.weights))
    db.commit()
    return db.scalars(select(ScorecardCriterion).order_by(ScorecardCriterion.sort_order)).all()


@router.get("")
def portfolio_scorecard(db: Session = Depends(get_db), _: User = Depends(require_roles(*VIEW_ROLES))):
    criteria, rows = _portfolio(db)
    return {
        "criteria": [{"key": c.key, "label": c.label, "weight": c.weight, "description": c.description} for c in criteria],
        "rows": rows,
    }


@router.post("/{agreement_id}/qualitative")
def set_qualitative(
    agreement_id: int,
    payload: QualitativeScoreUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages", "me")),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    agreement.qualitative_score = payload.score
    agreement.qualitative_note = payload.note
    audit(db, actor, "set_qualitative_score", "agreement", agreement_id, request, new_value=f"{payload.score}: {payload.note or ''}")
    db.commit()
    return {"agreement_id": agreement_id, "qualitative_score": payload.score, "qualitative_note": payload.note}


@router.get("/export.csv")
def export_scorecard(db: Session = Depends(get_db), _: User = Depends(require_roles(*VIEW_ROLES))):
    """FR-040: scorecard export (CSV opens directly in Excel)."""
    criteria, rows = _portfolio(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Reference", "Title", "Partner", "JKUAT Champion"] + [f"{c.label} ({c.weight}%)" for c in criteria] + ["Weighted Total", "Grade"])
    for row in rows:
        writer.writerow([row["reference_number"], row["title"], row["partner"], row["champion"]] + [row["scores"].get(c.key, "") for c in criteria] + [row["weighted_total"], row["grade"]])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=accord360-scorecard.csv"})
