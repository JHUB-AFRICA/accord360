"""Backward-compatible model exports from the feature modules."""

from app.modules.users.models import User
from app.modules.partners.models import Partner, PartnerApplication, PartnerApplicationDocument, PartnerReviewEvent
from app.modules.agreements.models import Agreement, Document
from app.modules.workflows.models import AuditLog, Correction, Deliverable, Notification, ValueRecord, WorkflowEvent

__all__ = [
    "Agreement",
    "AuditLog",
    "Correction",
    "Deliverable",
    "Document",
    "Notification",
    "Partner",
    "PartnerApplication",
    "PartnerApplicationDocument",
    "PartnerReviewEvent",
    "User",
    "ValueRecord",
    "WorkflowEvent",
]
