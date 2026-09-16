from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.access import can_download_document
from app.core.config import settings
from app.db.session import get_db
from app.deps import audit, require_roles
from app.modules.agreements.models import Agreement, Document
from app.modules.users.models import User
from app.utils.storage import StorageError, download_file

from . import service
from .schemas import PartnerAgreementDetailOut, PartnerAgreementOut, PartnerDocumentOut, PartnerWorkspaceOut

router = APIRouter(prefix="/partner", tags=["Partner workspace"])


def _membership_or_403(db: Session, user: User):
    membership = service.get_partner_membership(db, user)
    if not membership:
        raise HTTPException(status_code=403, detail="No active partner organization membership was found")
    return membership


@router.get("/me", response_model=PartnerWorkspaceOut)
def partner_me(db: Session = Depends(get_db), user: User = Depends(require_roles("partner"))):
    membership = _membership_or_403(db, user)
    partner = db.get(service.Partner, membership.partner_id)
    return {"user": user, "partner": partner, "membership_role": membership.membership_role}


@router.get("/agreements", response_model=list[PartnerAgreementOut])
def partner_agreements(db: Session = Depends(get_db), user: User = Depends(require_roles("partner"))):
    _membership_or_403(db, user)
    return service.list_partner_agreements(db, user)


@router.get("/agreements/{agreement_id}", response_model=PartnerAgreementDetailOut)
def partner_agreement(agreement_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("partner"))):
    membership = _membership_or_403(db, user)
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id, Agreement.partner_id == membership.partner_id).options(selectinload(Agreement.partner).selectinload(service.Partner.memberships), selectinload(Agreement.documents)))
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    documents = [PartnerDocumentOut.model_validate(item) for item in agreement.documents if can_download_document(user, agreement, item)]
    return {"id": agreement.id, "reference_number": agreement.reference_number, "title": agreement.title, "agreement_type": agreement.agreement_type, "partner_id": agreement.partner_id, "stage": agreement.stage, "status": agreement.status, "effective_date": agreement.effective_date, "expiry_date": agreement.expiry_date, "updated_at": agreement.updated_at, "purpose": agreement.purpose, "documents": documents}


@router.get("/agreements/{agreement_id}/documents/{document_id}/download")
def partner_document_download(agreement_id: int, document_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("partner"))):
    membership = _membership_or_403(db, user)
    agreement = db.scalar(select(Agreement).where(Agreement.id == agreement_id, Agreement.partner_id == membership.partner_id).options(selectinload(Agreement.partner).selectinload(service.Partner.memberships)))
    document = db.scalar(select(Document).where(Document.id == document_id, Document.agreement_id == agreement_id))
    if not agreement or not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if not can_download_document(user, agreement, document):
        raise HTTPException(status_code=403, detail="You cannot access this document")
    audit(db, user, "download_partner_document", "document", document.id, request, new_value=document.original_name)
    db.commit()
    if settings.storage_enabled:
        try:
            content = download_file(document.stored_name)
        except StorageError as exc:
            raise HTTPException(status_code=404, detail="Stored file is unavailable") from exc
        return StreamingResponse(content, media_type=document.mime_type or "application/octet-stream", headers={"Content-Disposition": f'attachment; filename="{document.original_name}"'})
    path = settings.upload_path / document.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored file is unavailable")
    return FileResponse(path=path, media_type=document.mime_type or "application/octet-stream", filename=document.original_name)
