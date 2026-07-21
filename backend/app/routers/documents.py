from __future__ import annotations

import mimetypes
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Agreement, Document, User
from ..schemas import DocumentOut

router = APIRouter(prefix="/agreements/{agreement_id}/documents", tags=["Documents"])
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".txt"}
MAX_FILE_SIZE = 25 * 1024 * 1024


@router.get("", response_model=list[DocumentOut])
def list_documents(agreement_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not _can_access_agreement(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.scalars(select(Document).where(Document.agreement_id == agreement_id).order_by(Document.created_at.desc())).all()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    agreement_id: int,
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form("supporting"),
    version: str = Form("1.0"),
    confidentiality: str = Form("internal"),
    is_official: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if not _can_access_agreement(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    if user.role in {"executive", "auditor", "approver"}:
        raise HTTPException(status_code=403, detail="Your role has read-only document access")
    suffix = Path(file.filename or "document").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    stored_name = f"{agreement.reference_number}_{uuid.uuid4().hex}{suffix}"
    destination = settings.upload_path / stored_name
    total = 0
    with destination.open("wb") as buffer:
        while chunk := file.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_FILE_SIZE:
                buffer.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")
            buffer.write(chunk)
    document = Document(
        agreement_id=agreement_id,
        document_type=document_type,
        version=version,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=file.content_type or mimetypes.guess_type(stored_name)[0],
        size_bytes=total,
        uploaded_by_id=user.id,
        is_official=is_official,
        confidentiality=confidentiality,
    )
    db.add(document)
    db.flush()
    audit(db, user, "upload_document", "document", document.id, request, new_value=document.original_name)
    db.commit()
    db.refresh(document)
    return document


def _can_access_agreement(user: User, agreement: Agreement) -> bool:
    if user.role in {"admin", "linkages", "executive", "auditor"}:
        return True
    if user.role == "researcher":
        return agreement.owner_id == user.id
    if user.role == "approver":
        return agreement.assigned_approver_id == user.id or agreement.department == user.department
    if user.role == "legal":
        return agreement.legal_reviewer_id == user.id or agreement.stage == "legal_review"
    if user.role == "me":
        return agreement.stage == "active"
    return False


@router.get("/{document_id}/download")
def download_document(
    agreement_id: int,
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    document = db.scalar(select(Document).where(Document.id == document_id, Document.agreement_id == agreement_id))
    if not agreement or not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _can_access_agreement(user, agreement):
        raise HTTPException(status_code=403, detail="Access denied")
    file_path = settings.upload_path / document.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file is missing")
    audit(db, user, "download_document", "document", document.id, request, new_value=document.original_name)
    db.commit()
    return FileResponse(
        path=file_path,
        filename=document.original_name,
        media_type=document.mime_type or "application/octet-stream",
    )
