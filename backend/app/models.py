"""Backward-compatible model exports from the feature modules."""

from app.modules.users.models import User
from app.modules.partners.models import Partner, PartnerApplication, PartnerApplicationDocument, PartnerReviewEvent, PartnerMembership, PartnerInvitation
from app.modules.agreements.models import Agreement, Document
from app.modules.workflows.models import AuditLog, Correction, Deliverable, Notification, ValueRecord, WorkflowEvent, ScorecardDefinition, ScorecardSnapshot
from app.modules.templates.models import Template
from app.modules.configuration.models import ConfigurationValue, ReferenceData

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
    "PartnerMembership",
    "PartnerInvitation",
    "User",
    "ValueRecord",
    "WorkflowEvent",
    "Template",
    "ConfigurationValue",
    "ReferenceData",
    "ScorecardDefinition",
    "ScorecardSnapshot",
]
