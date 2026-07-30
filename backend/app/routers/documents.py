from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..access import can_download_document, can_upload_document, ensure_can_view_agreement
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
    ensure_can_view_agreement(user, agreement)
    documents = db.scalars(select(Document).where(Document.agreement_id == agreement_id).order_by(Document.created_at.desc())).all()
    return [item for item in documents if can_download_document(user, agreement, item)]


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
    ensure_can_view_agreement(user, agreement)
    if not can_upload_document(user, agreement):
        raise HTTPException(status_code=403, detail="You cannot upload documents for this agreement")
    if confidentiality not in {"public", "internal", "confidential"}:
        raise HTTPException(status_code=400, detail="Invalid confidentiality level")
    if is_official and user.role not in {"linkages", "director_linkages", "legal", "vc_office"}:
        raise HTTPException(status_code=403, detail="Only Linkages, Legal or VC Office can mark an official version")
    if document_type == "signed" and is_official and user.role not in {"linkages", "director_linkages", "vc_office"}:
        raise HTTPException(status_code=403, detail="Only Linkages or VC Office can designate the official signed agreement")

    suffix = Path(file.filename or "document").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    stored_name = f"{agreement.reference_number}_{uuid.uuid4().hex}{suffix}"
    destination = settings.upload_path / stored_name
    total = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")
                buffer.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()

    if is_official:
        db.execute(
            update(Document)
            .where(Document.agreement_id == agreement_id, Document.document_type == document_type, Document.is_official.is_(True))
            .values(is_official=False)
        )

    document = Document(
        agreement_id=agreement_id,
        document_type=document_type,
        version=version.strip() or "1.0",
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
    audit(db, user, "upload_document", "document", document.id, request, new_value=f"{document.original_name}; official={is_official}")
    db.commit()
    db.refresh(document)
    return document


@router.get("/{document_id}/download")
def download_document(
    agreement_id: int,
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agreement = db.get(Agreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    document = db.scalar(select(Document).where(Document.id == document_id, Document.agreement_id == agreement_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if not can_download_document(user, agreement, document):
        raise HTTPException(status_code=403, detail="You cannot access this document")
    path = settings.upload_path / document.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored file is unavailable")
    audit(db, user, "download_document", "document", document.id, request, new_value=document.original_name)
    db.commit()
    return FileResponse(path=path, media_type=document.mime_type or "application/octet-stream", filename=document.original_name)
