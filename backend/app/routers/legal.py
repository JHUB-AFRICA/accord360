from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Agreement, LegalFeedback, User
from ..schemas import LegalFeedbackCreate, LegalFeedbackOut
from ..services import notify_user

router = APIRouter(prefix="/agreements/{agreement_id}/legal-feedback", tags=["Legal Workspace"])

THREAD_ROLES = {"legal", "linkages", "admin"}


def _can_participate(user: User, agreement: Agreement) -> bool:
    if user.role in THREAD_ROLES:
        return True
    # The JKUAT Champion who owns the agreement responds to legal queries (BR-004).
    return user.role == "champion" and agreement.owner_id == user.id


def _can_view(user: User, agreement: Agreement) -> bool:
    if _can_participate(user, agreement):
        return True
    return user.role in {"executive", "auditor", "dvc", "vc_office"}


@router.get("", response_model=list[LegalFeedbackOut])
def list_feedback(agreement_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not _can_view(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.scalars(
        select(LegalFeedback)
        .where(LegalFeedback.agreement_id == agreement_id)
        .options(selectinload(LegalFeedback.author))
        .order_by(LegalFeedback.created_at)
    ).all()


@router.post("", response_model=LegalFeedbackOut, status_code=status.HTTP_201_CREATED)
def post_feedback(
    agreement_id: int,
    payload: LegalFeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not _can_participate(user, agreement):
        raise HTTPException(status_code=403, detail="Only Legal, Linkages and the assigned Champion can post in this thread")
    if agreement.stage in {"active", "renewal_closure", "archived"}:
        raise HTTPException(status_code=400, detail="The legal feedback thread closes once the agreement is signed and active")
    item = LegalFeedback(agreement_id=agreement_id, author_id=user.id, message=payload.message, document_version=payload.document_version)
    db.add(item)
    db.flush()
    audit(db, user, "legal_feedback", "agreement", agreement_id, request, new_value=payload.message[:120])
    # Notify the counterpart side of the conversation.
    if user.role == "legal":
        notify_user(db, agreement.owner_id, "Legal feedback on your draft", f"{agreement.reference_number}: {payload.message[:140]}", agreement_id)
    else:
        from ..services import notify_roles
        notify_roles(db, {"legal"}, "Response in legal thread", f"{agreement.reference_number}: {payload.message[:140]}", agreement_id)
    db.commit()
    return db.scalar(select(LegalFeedback).where(LegalFeedback.id == item.id).options(selectinload(LegalFeedback.author)))
