from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Agreement, Deliverable, User, ValueRecord
from ..schemas import DeliverableCreate, DeliverableOut, ValueRecordCreate, ValueRecordOut

router = APIRouter(prefix="/agreements/{agreement_id}", tags=["Monitoring and Evaluation"])


def _can_manage_me(user: User, agreement: Agreement) -> bool:
    if agreement.stage != "active":
        return False
    if user.role in {"admin", "linkages", "me"}:
        return True
    return user.role == "champion" and agreement.owner_id == user.id


@router.post("/deliverables", response_model=DeliverableOut, status_code=status.HTTP_201_CREATED)
def create_deliverable(
    agreement_id: int,
    payload: DeliverableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not _can_manage_me(user, agreement):
        raise HTTPException(status_code=403, detail="M&E updates are limited to active agreements and authorized users")
    item = Deliverable(agreement_id=agreement_id, **payload.model_dump(), last_updated_at=datetime.utcnow())
    db.add(item)
    db.flush()
    audit(db, user, "create_deliverable", "deliverable", item.id, request, new_value=item.deliverable_type)
    db.commit()
    db.refresh(item)
    return item


@router.put("/deliverables/{deliverable_id}", response_model=DeliverableOut)
def update_deliverable(
    agreement_id: int,
    deliverable_id: int,
    payload: DeliverableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    item = db.scalar(select(Deliverable).where(Deliverable.id == deliverable_id, Deliverable.agreement_id == agreement_id))
    if not agreement or not item:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if not _can_manage_me(user, agreement):
        raise HTTPException(status_code=403, detail="M&E updates are limited to active agreements and authorized users")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.last_updated_at = datetime.utcnow()
    audit(db, user, "update_deliverable", "deliverable", item.id, request, new_value=f"actual={item.actual_value}")
    db.commit()
    db.refresh(item)
    return item


@router.post("/values", response_model=ValueRecordOut, status_code=status.HTTP_201_CREATED)
def create_value_record(
    agreement_id: int,
    payload: ValueRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if agreement.stage != "active" or user.role not in {"admin", "linkages", "me", "executive"}:
        raise HTTPException(status_code=403, detail="Value records are limited to active agreements and authorized roles")
    item = ValueRecord(agreement_id=agreement_id, **payload.model_dump())
    db.add(item)
    db.flush()
    audit(db, user, "create_value_record", "value_record", item.id, request, new_value=f"{item.currency} {item.amount}")
    db.commit()
    db.refresh(item)
    return item


# ---- BR-007 / FR-021..025: six-month reporting cycle ----

from datetime import date as _date

from sqlalchemy.orm import selectinload as _selectinload

from ..models import MEReportSchedule
from ..schemas import MEReportDecision, MEReportSubmit, MEScheduleOut
from ..services import notify_roles as _notify_roles, notify_user as _notify_user

_SCHEDULE_LOAD = (_selectinload(MEReportSchedule.submitted_by), _selectinload(MEReportSchedule.validated_by))


def _schedule_or_404(db: Session, agreement_id: int, schedule_id: int) -> MEReportSchedule:
    item = db.scalar(
        select(MEReportSchedule)
        .where(MEReportSchedule.id == schedule_id, MEReportSchedule.agreement_id == agreement_id)
        .options(*_SCHEDULE_LOAD)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Report schedule not found")
    return item


@router.get("/me-schedules", response_model=list[MEScheduleOut])
def list_schedules(agreement_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if user.role == "champion" and agreement.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if user.role in {"dvc", "vc_office"} and agreement.stage not in {"active", "renewal_closure", "archived"}:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.scalars(
        select(MEReportSchedule)
        .where(MEReportSchedule.agreement_id == agreement_id)
        .options(*_SCHEDULE_LOAD)
        .order_by(MEReportSchedule.due_date)
    ).all()


@router.post("/me-schedules/{schedule_id}/submit", response_model=MEScheduleOut)
def submit_report(
    agreement_id: int,
    schedule_id: int,
    payload: MEReportSubmit,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """FR-022: the JKUAT Champion submits the six-month activity report."""
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    is_owner_champion = user.role == "champion" and agreement.owner_id == user.id
    if not (is_owner_champion or user.role in {"me", "admin"}):
        raise HTTPException(status_code=403, detail="Only the assigned JKUAT Champion (or M&E/admin) can submit this report")
    item = _schedule_or_404(db, agreement_id, schedule_id)
    if item.status == "validated":
        raise HTTPException(status_code=400, detail="This reporting period has already been validated")
    item.activities = payload.activities
    item.outcomes = payload.outcomes
    item.challenges = payload.challenges
    item.evidence_document_id = payload.evidence_document_id
    item.status = "submitted"
    item.submitted_by_id = user.id
    item.submitted_at = datetime.utcnow()
    item.feedback = None
    audit(db, user, "submit_me_report", "me_schedule", item.id, request, new_value=item.period_label)
    _notify_roles(db, {"me", "linkages"}, "M&E report submitted", f"{agreement.reference_number}: {item.period_label} submitted by {user.full_name}.", agreement_id)
    db.commit()
    return _schedule_or_404(db, agreement_id, schedule_id)


@router.post("/me-schedules/{schedule_id}/validate", response_model=MEScheduleOut)
def validate_report(
    agreement_id: int,
    schedule_id: int,
    payload: MEReportDecision,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in {"me", "linkages", "admin"}:
        raise HTTPException(status_code=403, detail="Only M&E, Linkages or admin can validate reports")
    agreement = db.get(Agreement, agreement_id)
    item = _schedule_or_404(db, agreement_id, schedule_id)
    if item.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted reports can be validated")
    item.status = "validated"
    item.validated_by_id = user.id
    item.validated_at = datetime.utcnow()
    item.feedback = payload.feedback
    audit(db, user, "validate_me_report", "me_schedule", item.id, request)
    _notify_user(db, agreement.owner_id, "M&E report validated", f"{agreement.reference_number}: {item.period_label} was validated.", agreement_id)
    db.commit()
    return _schedule_or_404(db, agreement_id, schedule_id)


@router.post("/me-schedules/{schedule_id}/return", response_model=MEScheduleOut)
def return_report(
    agreement_id: int,
    schedule_id: int,
    payload: MEReportDecision,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in {"me", "linkages", "admin"}:
        raise HTTPException(status_code=403, detail="Only M&E, Linkages or admin can return reports")
    if not (payload.feedback or "").strip():
        raise HTTPException(status_code=400, detail="Feedback is required when returning a report")
    agreement = db.get(Agreement, agreement_id)
    item = _schedule_or_404(db, agreement_id, schedule_id)
    if item.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted reports can be returned")
    item.status = "returned"
    item.validated_by_id = user.id
    item.validated_at = datetime.utcnow()
    item.feedback = payload.feedback
    audit(db, user, "return_me_report", "me_schedule", item.id, request, new_value=payload.feedback[:120])
    _notify_user(db, agreement.owner_id, "M&E report returned", f"{agreement.reference_number}: {item.period_label} was returned — {payload.feedback[:120]}", agreement_id, "orange")
    db.commit()
    return _schedule_or_404(db, agreement_id, schedule_id)
