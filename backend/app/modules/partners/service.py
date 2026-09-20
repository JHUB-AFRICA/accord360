"""Partner service boundary."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import audit
from app.timeutils import utc_now

from .models import Partner, PartnerReviewEvent
from .schemas import PartnerCreate, PartnerReviewCreate

logger = logging.getLogger(__name__)


def get_partner(db: Session, partner_id: int) -> Partner | None:
    return db.get(Partner, partner_id)


def list_partners(db: Session) -> list[Partner]:
    return db.scalars(select(Partner).order_by(Partner.name)).all()


def create_partner(db: Session, payload: PartnerCreate) -> Partner:
    if db.scalar(select(Partner).where(Partner.name == payload.name)):
        raise ValueError("Partner already exists")
    partner = Partner(**payload.model_dump())
    db.add(partner)
    db.flush()
    return partner


def update_partner(db: Session, partner_id: int, payload: PartnerCreate) -> tuple[Partner, str]:
    partner = db.get(Partner, partner_id)
    if not partner:
        raise LookupError("Partner not found")
    old = partner.name
    for key, value in payload.model_dump().items():
        setattr(partner, key, value)
    return partner, old


def list_partner_reviews(db: Session, partner_id: int) -> list[PartnerReviewEvent]:
    return db.scalars(
        select(PartnerReviewEvent)
        .where(PartnerReviewEvent.partner_id == partner_id)
        .order_by(PartnerReviewEvent.created_at.desc())
    ).all()


def review_partner(db: Session, partner_id: int, payload: PartnerReviewCreate, actor, request) -> PartnerReviewEvent:
    partner = db.get(Partner, partner_id)
    if not partner:
        raise LookupError("Partner not found")
    if partner.status == payload.status:
        raise ValueError("The partner already has this status")
    old_status = partner.status
    partner.status = payload.status
    review = PartnerReviewEvent(
        partner_id=partner.id,
        reviewer_id=actor.id,
        old_status=old_status,
        new_status=payload.status,
        reason=payload.reason.strip(),
        created_at=utc_now(),
    )
    db.add(review)
    db.flush()
    audit(
        db,
        actor,
        "review_partner",
        "partner",
        partner.id,
        request,
        old_value=old_status,
        new_value=f"{payload.status}: {payload.reason.strip()}",
    )
    db.commit()
    db.refresh(review)
    return review
