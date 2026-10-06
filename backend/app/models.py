"""Backward-compatible model exports from the feature modules."""

from app.modules.users.models import User
from app.modules.partners.models import Partner, PartnerReviewEvent
from app.modules.agreements.models import Agreement, AgreementDrivePermission, AgreementVersion, ProgressUpdate
from app.modules.workflows.models import AuditLog, Notification, WorkflowEvent
from app.modules.templates.models import Template, FieldDefinition
from app.modules.configuration.models import ConfigurationValue, ReferenceData

__all__ = [
    "Agreement",
    "AgreementDrivePermission",
    "AgreementVersion",
    "ProgressUpdate",
    "AuditLog",
    "Notification",
    "Partner",
    "PartnerReviewEvent",
    "User",
    "WorkflowEvent",
    "Template",
    "FieldDefinition",
    "ConfigurationValue",
    "ReferenceData",
]
