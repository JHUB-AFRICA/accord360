"""Partner and public partner-application service boundary."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.deps import audit
from app.timeutils import utc_now

from .models import Partner, PartnerApplication, PartnerApplicationDocument, PartnerReviewEvent
from .schemas import PartnerApplicationReview, PartnerCreate, PartnerReviewCreate

logger = logging.getLogger(__name__)
MAX_APPLICATION_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_APPLICATION_EXTENSIONS = {".pdf", ".doc", ".docx"}
VERIFICATION_TTL = timedelta(hours=24)


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


def _new_reference(db: Session) -> str:
    while True:
        reference = f"JKUAT-PAR-{utc_now().year}-{secrets.token_hex(3).upper()}"
        if not db.scalar(select(PartnerApplication).where(PartnerApplication.reference_number == reference)):
            return reference


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_application(db: Session, fields: dict[str, str], uploads: list[tuple[str, str | None, bytes]]) -> tuple[PartnerApplication, str]:
    official_email = fields["official_email"].strip().lower()
    duplicate = db.scalar(
        select(PartnerApplication).where(
            PartnerApplication.official_email == official_email,
            PartnerApplication.status.in_(("pending_email_verification", "pending_review", "needs_information")),
        )
    )
    if duplicate:
        raise ValueError("An active application already exists for this official email")

    verification_token = secrets.token_urlsafe(32)
    application = PartnerApplication(
        reference_number=_new_reference(db),
        institution_name=fields["institution_name"].strip(),
        institution_type=fields["institution_type"].strip(),
        country=fields["country"].strip(),
        region=fields.get("region", "").strip() or None,
        website=fields["website"].strip(),
        registration_number=fields.get("registration_number", "").strip() or None,
        contact_name=fields["contact_name"].strip(),
        job_title=fields["job_title"].strip(),
        official_email=official_email,
        phone=fields["phone"].strip(),
        collaboration_area=fields["collaboration_area"].strip(),
        strategic_alignment=fields["strategic_alignment"].strip(),
        consent_at=utc_now(),
        verification_token_hash=_token_hash(verification_token),
        verification_token_expires_at=utc_now() + VERIFICATION_TTL,
    )
    db.add(application)
    db.flush()

    application_dir = settings.upload_path / "partner-applications" / application.reference_number
    application_dir.mkdir(parents=True, exist_ok=True)
    for original_name, mime_type, content in uploads:
        suffix = Path(original_name).suffix.lower()
        stored_name = f"{uuid4().hex}{suffix}"
        (application_dir / stored_name).write_bytes(content)
        db.add(
            PartnerApplicationDocument(
                application_id=application.id,
                original_name=Path(original_name).name,
                stored_name=f"partner-applications/{application.reference_number}/{stored_name}",
                mime_type=mime_type,
                size_bytes=len(content),
                created_at=utc_now(),
            )
        )

    audit(db, None, "submit_partner_application", "partner_application", application.id, new_value=application.reference_number)
    db.commit()
    db.refresh(application)
    logger.info(
        "partner_application_email_verification reference=%s email=%s token=%s expires_at=%s",
        application.reference_number,
        application.official_email,
        verification_token,
        application.verification_token_expires_at.isoformat(),
    )
    return application, verification_token


def verify_application_email(db: Session, token: str) -> PartnerApplication:
    application = db.scalar(
        select(PartnerApplication).where(PartnerApplication.verification_token_hash == _token_hash(token))
    )
    if not application or not application.verification_token_expires_at or application.verification_token_expires_at < utc_now():
        raise LookupError("The verification link is invalid or expired")
    if application.status != "pending_email_verification":
        return application
    application.status = "pending_review"
    application.email_verified_at = utc_now()
    application.verification_token_hash = None
    application.verification_token_expires_at = None
    audit(db, None, "verify_partner_application_email", "partner_application", application.id, new_value=application.reference_number)
    db.commit()
    db.refresh(application)
    return application


def list_applications(db: Session) -> list[PartnerApplication]:
    return db.scalars(select(PartnerApplication).order_by(PartnerApplication.created_at.desc())).all()


def review_application(db: Session, application_id: int, payload: PartnerApplicationReview, actor, request) -> PartnerApplication:
    application = db.get(PartnerApplication, application_id)
    if not application:
        raise LookupError("Partner application not found")
    if application.status == "pending_email_verification":
        raise ValueError("The applicant must verify the official email before review")

    old_status = application.status
    application.status = payload.status
    application.review_notes = payload.review_notes.strip()
    application.reviewed_by_id = actor.id
    application.reviewed_at = utc_now()

    if payload.status == "approved":
        existing = db.scalar(select(Partner).where(Partner.name == application.institution_name))
        if not existing:
            db.add(
                Partner(
                    name=application.institution_name,
                    sector=application.collaboration_area[:120],
                    partner_type=application.institution_type,
                    country=application.country,
                    contact_name=application.contact_name,
                    contact_email=application.official_email,
                    status="active",
                )
            )

    audit(
        db,
        actor,
        "review_partner_application",
        "partner_application",
        application.id,
        request,
        old_value=old_status,
        new_value=f"{payload.status}: {application.review_notes}",
    )
    db.commit()
    db.refresh(application)
    return application
