"""Partner and public partner-application service boundary."""

from __future__ import annotations

import hashlib
import logging
import secrets
import logging
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.deps import audit
from app.timeutils import utc_now

from .models import Partner, PartnerApplication, PartnerApplicationDocument, PartnerReviewEvent, PartnerMembership, PartnerInvitation
from app.modules.users.models import User
from app.modules.agreements.models import Agreement
from .schemas import PartnerApplicationReview, PartnerCreate, PartnerInvitationCreate, PartnerReviewCreate

logger = logging.getLogger(__name__)
MAX_APPLICATION_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_APPLICATION_EXTENSIONS = {".pdf", ".doc", ".docx"}
VERIFICATION_TTL = timedelta(hours=24)
INVITATION_TTL = timedelta(hours=72)


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


def create_partner_invitation(db: Session, partner_id: int, payload: PartnerInvitationCreate, actor, request) -> tuple[PartnerInvitation, str]:
    partner = db.get(Partner, partner_id)
    if not partner:
        raise LookupError("Partner not found")
    email = payload.email.lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user and existing_user.role != "partner":
        raise ValueError("This email already belongs to an internal account")
    duplicate = db.scalar(select(PartnerInvitation).where(PartnerInvitation.partner_id == partner_id, PartnerInvitation.email == email, PartnerInvitation.accepted_at.is_(None)))
    if duplicate:
        raise ValueError("An active invitation already exists for this email")
    token = secrets.token_urlsafe(32)
    invitation = PartnerInvitation(
        partner_id=partner_id,
        email=email,
        full_name=payload.full_name.strip(),
        token_hash=_token_hash(token),
        expires_at=utc_now() + INVITATION_TTL,
        invited_by_id=actor.id,
        created_at=utc_now(),
    )
    db.add(invitation)
    db.flush()
    audit(db, actor, "invite_partner_user", "partner_invitation", invitation.id, request, new_value=f"{partner.name}:{email}")
    db.commit()
    db.refresh(invitation)
    logger.info("partner_invitation_email partner=%s email=%s token=%s expires_at=%s", partner.name, email, token, invitation.expires_at.isoformat())
    return invitation, token


def accept_partner_invitation(db: Session, token: str, password: str):
    invitation = db.scalar(select(PartnerInvitation).where(PartnerInvitation.token_hash == _token_hash(token)))
    if not invitation or invitation.accepted_at or invitation.expires_at < utc_now():
        raise LookupError("The partner invitation is invalid or expired")
    existing = db.scalar(select(User).where(User.email == invitation.email))
    if existing:
        raise ValueError("An account already exists for this invitation email")
    user = User(full_name=invitation.full_name, email=invitation.email, password_hash=hash_password(password), role="partner")
    db.add(user)
    db.flush()
    db.add(PartnerMembership(partner_id=invitation.partner_id, user_id=user.id, membership_role="member", status="active", joined_at=utc_now()))
    invitation.accepted_at = utc_now()
    audit(db, None, "accept_partner_invitation", "partner_invitation", invitation.id, new_value=invitation.email)
    db.commit()
    db.refresh(user)
    return user


def get_partner_membership(db: Session, user) -> PartnerMembership | None:
    return db.scalar(select(PartnerMembership).where(PartnerMembership.user_id == user.id, PartnerMembership.status == "active"))


def list_partner_agreements(db: Session, user):
    membership = get_partner_membership(db, user)
    if not membership:
        return []
    return db.scalars(
        select(Agreement).where(Agreement.partner_id == membership.partner_id).order_by(Agreement.updated_at.desc())
    ).all()


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
