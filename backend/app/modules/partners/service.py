"""Partner service boundary; database sessions are supplied by callers."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Partner
from .schemas import PartnerCreate


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
