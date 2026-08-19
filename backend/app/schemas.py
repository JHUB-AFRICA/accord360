"""Backward-compatible schema exports; feature schemas are canonical."""

from app.modules.users.schemas import LoginRequest, TokenResponse, UserCreate, UserOut, UserUpdate
from app.modules.partners.schemas import PartnerCreate, PartnerOut
from app.modules.agreements.schemas import AgreementCreate, AgreementDetailOut, AgreementListOut, AgreementUpdate, DocumentOut
from app.modules.workflows.schemas import AuditLogOut, DeliverableCreate, DeliverableOut, NotificationOut, TransitionRequest, ValueRecordCreate, ValueRecordOut, WorkflowEventOut

__all__ = [name for name in globals() if not name.startswith("_")]
