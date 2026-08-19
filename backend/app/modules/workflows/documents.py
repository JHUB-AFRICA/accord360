from __future__ import annotations

import mimetypes
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ...access import can_download_document, can_upload_document, ensure_can_view_agreement
from ...core.config import settings
from ...db.session import get_db
from ...deps import audit, get_current_user
from ...models import Agreement, Document, User
from ...schemas import DocumentOut
from ...utils.storage import StorageError, delete_file, download_file, upload_file

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
    content = tempfile.SpooledTemporaryFile(max_size=MAX_FILE_SIZE)
    total = 0
    try:
        while chunk := file.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")
            content.write(chunk)
        content.seek(0)
        if settings.storage_enabled:
            upload_file(content, stored_name, file.content_type)
        else:
            destination = settings.upload_path / stored_name
            content.seek(0)
            with destination.open("wb") as buffer:
                while chunk := content.read(1024 * 1024):
                    buffer.write(chunk)
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        content.close()
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
    try:
        db.add(document)
        db.flush()
        audit(db, user, "upload_document", "document", document.id, request, new_value=f"{document.original_name}; official={is_official}")
        db.commit()
    except Exception:
        db.rollback()
        if settings.storage_enabled:
            try:
                delete_file(stored_name)
            except StorageError:
                pass
        raise
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
    audit(db, user, "download_document", "document", document.id, request, new_value=document.original_name)
    db.commit()
    if settings.storage_enabled:
        try:
            content = download_file(document.stored_name)
        except StorageError as exc:
            raise HTTPException(status_code=404, detail="Stored file is unavailable") from exc
        return StreamingResponse(
            content,
            media_type=document.mime_type or "application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{document.original_name}"'},
        )
    path = settings.upload_path / document.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored file is unavailable")
    from fastapi.responses import FileResponse
    return FileResponse(path=path, media_type=document.mime_type or "application/octet-stream", filename=document.original_name)
