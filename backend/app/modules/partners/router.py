from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...deps import audit, get_current_user, require_roles
from . import service
from app.modules.users.models import User
from app.modules.users.router import auth_router
from .schemas import (
    PartnerApplicationOut,
    PartnerApplicationReview,
    PartnerCreate,
    PartnerEmailVerificationResponse,
    PartnerOut,
    PartnerReviewCreate,
    PartnerReviewOut,
    PartnerRegistrationResponse,
    PartnerInvitationAccept,
    PartnerInvitationCreate,
    PartnerInvitationOut,
    PartnerInvitationAcceptOut,
)

router = APIRouter(prefix="/partners", tags=["Partners"])


@auth_router.post("/register-partner", response_model=PartnerRegistrationResponse, status_code=status.HTTP_202_ACCEPTED)
async def register_partner(
    institution_name: str = Form(..., min_length=2, max_length=240),
    institution_type: str = Form(..., min_length=2, max_length=120),
    country: str = Form(..., min_length=2, max_length=100),
    website: str = Form(..., min_length=4, max_length=300),
    contact_name: str = Form(..., min_length=2, max_length=160),
    job_title: str = Form(..., min_length=2, max_length=160),
    official_email: str = Form(..., min_length=5, max_length=200),
    phone: str = Form(..., min_length=5, max_length=60),
    collaboration_area: str = Form(..., min_length=10, max_length=4000),
    strategic_alignment: str = Form(..., min_length=10, max_length=4000),
    region: str = Form("", max_length=120),
    registration_number: str = Form("", max_length=160),
    consent: bool = Form(...),
    files: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
):
    if not consent:
        raise HTTPException(status_code=422, detail="Consent is required")
    uploads: list[tuple[str, str | None, bytes]] = []
    for upload in files or []:
        original_name = upload.filename or ""
        from pathlib import Path

        suffix = Path(original_name).suffix.lower()
        if suffix not in {".pdf", ".doc", ".docx"}:
            raise HTTPException(status_code=422, detail="Only PDF, DOC and DOCX files are accepted")
        content = await upload.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Each supporting file must be 10 MB or smaller")
        uploads.append((original_name, upload.content_type, content))
    try:
        application, _ = service.create_application(
            db,
            {
                "institution_name": institution_name,
                "institution_type": institution_type,
                "country": country,
                "region": region,
                "website": website,
                "registration_number": registration_number,
                "contact_name": contact_name,
                "job_title": job_title,
                "official_email": official_email,
                "phone": phone,
                "collaboration_area": collaboration_area,
                "strategic_alignment": strategic_alignment,
            },
            uploads,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return PartnerRegistrationResponse(
        reference_number=application.reference_number,
        status=application.status,
        message="Application received. Check the official email address to verify the application.",
    )


@auth_router.get("/verify-partner-email", response_model=PartnerEmailVerificationResponse)
def verify_partner_email(token: str, db: Session = Depends(get_db)):
    try:
        application = service.verify_application_email(db, token)
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PartnerEmailVerificationResponse(
        reference_number=application.reference_number,
        status=application.status,
        message="Official email verified. The Directorate can now review the application.",
    )


@auth_router.post("/partner-invitations/{token}/accept", response_model=PartnerInvitationAcceptOut)
def accept_partner_invitation(token: str, payload: PartnerInvitationAccept, db: Session = Depends(get_db)):
    try:
        user = service.accept_partner_invitation(db, token, payload.password)
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return PartnerInvitationAcceptOut(reference_number=f"PARTNER-USER-{user.id}", status="accepted", message="Partner account created. You can now sign in to the partner workspace.")


@router.get("", response_model=list[PartnerOut])
def list_partners(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return service.list_partners(db)


@router.post("", response_model=PartnerOut, status_code=status.HTTP_201_CREATED)
def create_partner(
    payload: PartnerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "director_linkages", "researcher")),
):
    try:
        partner = service.create_partner(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    audit(db, actor, "create_partner", "partner", partner.id, request, new_value=partner.name)
    db.commit()
    db.refresh(partner)
    return partner


@router.put("/{partner_id}", response_model=PartnerOut)
def update_partner(
    partner_id: int,
    payload: PartnerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("linkages", "director_linkages")),
):
    try:
        partner, old = service.update_partner(db, partner_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    audit(db, actor, "update_partner", "partner", partner.id, request, old_value=old, new_value=partner.name)
    db.commit()
    db.refresh(partner)
    return partner


@router.post("/{partner_id}/invitations", response_model=PartnerInvitationOut, status_code=status.HTTP_201_CREATED)
def invite_partner_user(
    partner_id: int,
    payload: PartnerInvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages", "director_linkages")),
):
    try:
        invitation, _ = service.create_partner_invitation(db, partner_id, payload, actor, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return PartnerInvitationOut.model_validate(invitation).model_copy(update={"message": "Invitation created. The acceptance token is delivered through the configured email provider."})


@router.get("/{partner_id}/reviews", response_model=list[PartnerReviewOut])
def list_partner_reviews(
    partner_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "linkages", "director_linkages")),
):
    if not service.get_partner(db, partner_id):
        raise HTTPException(status_code=404, detail="Partner not found")
    return service.list_partner_reviews(db, partner_id)


@router.post("/{partner_id}/review", response_model=PartnerReviewOut, status_code=status.HTTP_201_CREATED)
def review_partner(
    partner_id: int,
    payload: PartnerReviewCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages", "director_linkages")),
):
    try:
        return service.review_partner(db, partner_id, payload, actor, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/applications", response_model=list[PartnerApplicationOut])
def list_partner_applications(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "linkages", "director_linkages")),
):
    return service.list_applications(db)


@router.patch("/applications/{application_id}/review", response_model=PartnerApplicationOut)
def review_partner_application(
    application_id: int,
    payload: PartnerApplicationReview,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin", "linkages", "director_linkages")),
):
    try:
        return service.review_application(db, application_id, payload, actor, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
