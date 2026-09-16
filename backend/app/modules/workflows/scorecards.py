from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.access import apply_agreement_scope
from app.db.session import get_db
from app.deps import audit, get_current_user, require_roles
from app.models import Agreement, ScorecardDefinition, ScorecardSnapshot, User
from app.timeutils import utc_now

from .schemas import ScoreComponent, ScorecardDefinitionCreate, ScorecardDefinitionOut, ScorecardOut, ScorecardSnapshotOut

DEFAULT_WEIGHTS = {"deliverable_achievement": 50, "evidence_completeness": 20, "compliance_timeliness": 20, "financial_value": 10}
RECALCULATION_ROLES = {"me", "linkages", "director_linkages"}


def _definition(db: Session, actor: User | None = None) -> ScorecardDefinition:
    definition = db.scalar(select(ScorecardDefinition).where(ScorecardDefinition.is_active.is_(True)).order_by(ScorecardDefinition.id.desc()))
    if definition:
        return definition
    definition = ScorecardDefinition(name="Institutional collaboration scorecard", version="1.0", weights_json=json.dumps(DEFAULT_WEIGHTS), is_active=True, created_by_id=actor.id if actor else None)
    db.add(definition)
    db.flush()
    return definition


def _calculate(agreement: Agreement, weights: dict[str, int]) -> tuple[int, str, list[dict]]:
    deliverables = agreement.deliverables
    if not deliverables:
        return 0, "No baseline", []
    completion = sum((min(100, float(item.actual_value / item.target_value) * 100) if item.target_value > 0 else 100 if item.actual_value > 0 else 0) for item in deliverables) / len(deliverables)
    evidence = sum(1 for item in deliverables if item.evidence_document_id) / len(deliverables) * 100
    timeliness = {"green": 90, "yellow": 70, "orange": 45}.get(agreement.status_color, 25)
    value = 80 if any(float(item.amount) > 0 for item in agreement.values) else 40
    scores = {"deliverable_achievement": round(completion), "evidence_completeness": round(evidence), "compliance_timeliness": timeliness, "financial_value": value}
    labels = {"deliverable_achievement": "Deliverable achievement", "evidence_completeness": "Evidence completeness", "compliance_timeliness": "Compliance and timeliness", "financial_value": "Financial/resource value"}
    components = [{"name": labels[key], "weight": weights[key], "score": scores[key]} for key in weights]
    overall = round(sum(item["score"] * item["weight"] / 100 for item in components))
    category = "Strong partnership" if overall >= 80 else "Stable partnership" if overall >= 60 else "At-risk partnership" if overall >= 40 else "Critical attention"
    return overall, category, components


def _agreement_query(user: User):
    return apply_agreement_scope(select(Agreement).options(selectinload(Agreement.partner), selectinload(Agreement.deliverables), selectinload(Agreement.values)), user)


def _snapshot_out(snapshot: ScorecardSnapshot) -> ScorecardSnapshotOut:
    return ScorecardSnapshotOut.model_validate({"id": snapshot.id, "definition_id": snapshot.definition_id, "overall": snapshot.overall, "category": snapshot.category, "components": json.loads(snapshot.components_json), "source_updated_at": snapshot.source_updated_at, "calculated_by": snapshot.calculated_by, "created_at": snapshot.created_at})


def _definition_out(definition: ScorecardDefinition) -> ScorecardDefinitionOut:
    return ScorecardDefinitionOut.model_validate({"id": definition.id, "name": definition.name, "version": definition.version, "weights": json.loads(definition.weights_json), "is_active": definition.is_active, "created_by": definition.created_by, "created_at": definition.created_at, "updated_at": definition.updated_at})


def list_scorecards(db: Session, user: User) -> list[ScorecardOut]:
    agreements = db.scalars(_agreement_query(user).where(Agreement.stage == "active").order_by(Agreement.updated_at.desc())).all()
    definition = _definition(db, user)
    snapshots = db.scalars(select(ScorecardSnapshot).where(ScorecardSnapshot.definition_id == definition.id).order_by(ScorecardSnapshot.created_at.desc())).all()
    latest: dict[int, ScorecardSnapshot] = {}
    for snapshot in snapshots:
        latest.setdefault(snapshot.agreement_id, snapshot)
    changed = False
    for agreement in agreements:
        snapshot = latest.get(agreement.id)
        if not snapshot or snapshot.source_updated_at < agreement.updated_at:
            snapshot = _create_snapshot(db, agreement, definition, user)
            latest[agreement.id] = snapshot
            changed = True
    if changed or definition.id is not None:
        db.commit()
    return [{"agreement_id": agreement.id, "reference_number": agreement.reference_number, "title": agreement.title, "partner_name": agreement.partner.name, "agreement_type": agreement.agreement_type, "snapshot": _snapshot_out(latest[agreement.id])} for agreement in agreements]


def _create_snapshot(db: Session, agreement: Agreement, definition: ScorecardDefinition, actor: User) -> ScorecardSnapshot:
    overall, category, components = _calculate(agreement, json.loads(definition.weights_json))
    snapshot = ScorecardSnapshot(agreement_id=agreement.id, definition_id=definition.id, overall=overall, category=category, components_json=json.dumps(components), source_updated_at=agreement.updated_at, calculated_by_id=actor.id, created_at=utc_now())
    db.add(snapshot)
    db.flush()
    return snapshot


def recalculate(db: Session, agreement_id: int, actor: User, request: Request) -> ScorecardOut:
    agreement = db.scalar(_agreement_query(actor).where(Agreement.id == agreement_id))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    definition = _definition(db, actor)
    snapshot = _create_snapshot(db, agreement, definition, actor)
    audit(db, actor, "recalculate_scorecard", "scorecard", snapshot.id, request, new_value=f"agreement={agreement.id}; overall={snapshot.overall}")
    db.commit()
    db.refresh(snapshot)
    return {"agreement_id": agreement.id, "reference_number": agreement.reference_number, "title": agreement.title, "partner_name": agreement.partner.name, "agreement_type": agreement.agreement_type, "snapshot": _snapshot_out(snapshot)}


router = APIRouter(prefix="/scorecards", tags=["Scorecards"])


@router.get("", response_model=list[ScorecardOut])
def scorecards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == "partner":
        raise HTTPException(status_code=403, detail="Partner users must use the partner workspace")
    return list_scorecards(db, user)


@router.post("/{agreement_id}/recalculate", response_model=ScorecardOut)
def recalculate_scorecard(agreement_id: int, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_roles(*RECALCULATION_ROLES))):
    return recalculate(db, agreement_id, actor, request)


@router.get("/{agreement_id}/history", response_model=list[ScorecardSnapshotOut])
def scorecard_history(agreement_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreement = db.scalar(_agreement_query(user).where(Agreement.id == agreement_id))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    snapshots = db.scalars(select(ScorecardSnapshot).where(ScorecardSnapshot.agreement_id == agreement_id).order_by(ScorecardSnapshot.created_at.desc())).all()
    return [_snapshot_out(item) for item in snapshots]


@router.get("/definitions", response_model=list[ScorecardDefinitionOut])
def scorecard_definitions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [_definition_out(item) for item in db.scalars(select(ScorecardDefinition).order_by(ScorecardDefinition.id.desc())).all()]


@router.post("/definitions", response_model=ScorecardDefinitionOut, status_code=status.HTTP_201_CREATED)
def create_scorecard_definition(payload: ScorecardDefinitionCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_roles("admin"))):
    if sum(payload.weights.values()) != 100:
        raise HTTPException(status_code=422, detail="Scorecard weights must total 100")
    db.query(ScorecardDefinition).update({ScorecardDefinition.is_active: False})
    definition = ScorecardDefinition(name=payload.name, version=payload.version, weights_json=json.dumps(payload.weights), is_active=True, created_by_id=actor.id)
    db.add(definition)
    db.flush()
    audit(db, actor, "create_scorecard_definition", "scorecard_definition", definition.id, request, new_value=f"{definition.name} v{definition.version}")
    db.commit()
    db.refresh(definition)
    return _definition_out(definition)
