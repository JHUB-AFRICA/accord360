from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.modules.users.schemas import ORMModel, UserOut

class WorkflowEventOut(ORMModel):
    id: int
    from_stage: str | None
    to_stage: str
    action: str
    comment: str | None
    created_at: datetime
    actor: UserOut


# Exactly the transition-graph edges in REBUILD_BRIEF.md Section 2.4 that are
# triggered by a user action (as opposed to the two system/automatic edges —
# draft_generated remains the Linkages intake state until Linkages uploads the
# legal draft; that upload transitions the agreement to pending_legal_review.
# fully_executed -> expired on the daily expiry job (Phase 3) — neither of
# which is exposed through this endpoint).
TransitionAction = Literal[
    "submit",
    "send_to_legal",
    "return_to_researcher",
    "return_to_linkages",
    "resubmit",
    "approve",
    "start_signing",
    "mark_fully_executed",
    "renew",
    "archive",
]


class TransitionRequest(BaseModel):
    action: TransitionAction
    comment: str | None = Field(default=None, max_length=4000)

class NotificationOut(ORMModel):
    id: int
    title: str
    message: str
    level: str
    is_read: bool
    agreement_id: int | None
    created_at: datetime

class AuditLogOut(ORMModel):
    id: int
    action: str
    object_type: str
    object_id: str
    old_value: str | None
    new_value: str | None
    source_ip: str | None
    created_at: datetime
    actor: UserOut | None
