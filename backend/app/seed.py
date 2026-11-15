from __future__ import annotations

import argparse
from datetime import date, timedelta

from app.core.config import settings
from sqlalchemy import delete, select

from .db.session import SessionLocal
from .models import (
    Agreement,
    AgreementDrivePermission,
    AgreementVersion,
    AuditLog,
    FieldDefinition,
    Notification,
    Partner,
    ProgressUpdate,
    Template,
    User,
    WorkflowEvent,
)
from .modules.templates import service as template_service
from .modules.templates.schemas import TemplateCreate
from .core.security import hash_password

# Exactly four roles per REBUILD_BRIEF.md Section 2.1.
DEFAULT_USERS = [
    ("JKUAT Researcher", "researcher@accord360.app", "Researcher@123", "researcher", "Computing"),
    ("Linkages Officer", "linkages@accord360.app", "Linkages@123", "linkages", "Directorate of Linkages"),
    ("Legal Reviewer", "legal@accord360.app", "Legal@123", "legal", "Legal Office"),
    ("M&E Officer", "me@accord360.app", "Measure@123", "me", "M&E"),
]

# Single source of truth for the Researcher's structured form fields and the
# {{tag}} placeholders scanned during template validation (Phase 2).
DEFAULT_FIELD_DEFINITIONS = [
    ("partner_name", "Partner Organization Name", True),
    ("agreement_title", "Agreement Title", True),
    ("department", "Department", True),
    ("start_date", "Start Date", True),
    ("end_date", "End Date", True),
    ("researcher_name", "Researcher Name", True),
]


def seed_field_definitions(db) -> None:
    for field_name, label, required in DEFAULT_FIELD_DEFINITIONS:
        if not db.scalar(select(FieldDefinition).where(FieldDefinition.field_name == field_name)):
            db.add(FieldDefinition(field_name=field_name, label=label, required=required))
    db.flush()


STANDARD_MOU_DOCUMENT_TYPE = "MoU"


def seed_standard_mou_template(db, linkages_user: User) -> None:
    # With real Drive enabled, templates come only from the Templates page —
    # never seed a dummy one with a fake Doc id.
    if settings.google_drive_enabled:
        return
    if db.scalar(
        select(Template).where(Template.document_type == STANDARD_MOU_DOCUMENT_TYPE, Template.is_active.is_(True))
    ):
        return
    # GOOGLE_DOCS_DRAFTING_BRIEF.md Section 4 — a demo/dev environment
    # without real Drive credentials still needs an active Template for
    # create_agreement's master_doc_id check; this id is only real once a
    # Google Doc with this id is actually shared with the service account
    # (see the brief's Section 1 external setup).
    template = template_service.create_template(
        db,
        TemplateCreate(document_type=STANDARD_MOU_DOCUMENT_TYPE, master_doc_id="demo-standard-mou-master-doc"),
        linkages_user,
        request=None,
    )
    template_service.activate_template(db, template.id, linkages_user, request=None)


def seed(reset: bool = False, demo: bool = True) -> None:
    db = SessionLocal()
    try:
        if reset:
            for model in [
                Notification,
                AuditLog,
                AgreementVersion,
                ProgressUpdate,
                WorkflowEvent,
                AgreementDrivePermission,
                Agreement,
                Partner,
                Template,
                FieldDefinition,
                User,
            ]:
                db.execute(delete(model))
            db.commit()

        users: dict[str, User] = {}
        for full_name, email, password, role, department in DEFAULT_USERS:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(
                    full_name=full_name,
                    email=email,
                    password_hash=hash_password(password),
                    role=role,
                    department=department,
                )
                db.add(user)
                db.flush()
            users[role] = user

        seed_field_definitions(db)
        seed_standard_mou_template(db, users["linkages"])

        if demo and not db.scalar(select(Agreement.id).limit(1)):
            partner_a = Partner(
                name="Technical University of Munich",
                sector="Higher Education",
                partner_type="University",
                country="Germany",
                contact_name="Partnership Office",
                contact_email="partnerships@example.org",
                legal_counterpart="International Legal Counsel",
                liaison="Global Partnerships Manager",
            )
            partner_b = Partner(
                name="Kenya Agricultural and Livestock Research Organization",
                sector="Agriculture",
                partner_type="Government Research Institution",
                country="Kenya",
                contact_name="Research Partnerships Office",
                contact_email="research@example.org",
                liaison="Senior ICT Officer",
            )
            db.add_all([partner_a, partner_b])
            db.flush()

            draft = Agreement(
                title="AI Research and Innovation Collaboration",
                department="School of Computing and Information Technology",
                partner_id=partner_a.id,
                researcher_id=users["researcher"].id,
                status="draft_generated",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=730),
            )
            in_legal_review = Agreement(
                title="Agricultural Data Collaboration Agreement",
                department="Department of Computing",
                partner_id=partner_b.id,
                researcher_id=users["researcher"].id,
                status="legal_review",
                start_date=date.today() - timedelta(days=10),
                end_date=date.today() + timedelta(days=700),
            )
            fully_executed = Agreement(
                title="Digital Skills Implementation Partnership",
                department="Computing",
                partner_id=partner_b.id,
                researcher_id=users["researcher"].id,
                status="fully_executed",
                start_date=date.today() - timedelta(days=400),
                end_date=date.today() + timedelta(days=300),
                expiry_alert_date=date.today() + timedelta(days=120),
            )
            expired = Agreement(
                title="Manufacturing Research Collaboration",
                department="Computing",
                partner_id=partner_a.id,
                researcher_id=users["researcher"].id,
                status="expired",
                start_date=date.today() - timedelta(days=800),
                end_date=date.today() - timedelta(days=10),
                expiry_alert_date=date.today() - timedelta(days=190),
                expiry_notified=True,
            )
            db.add_all([draft, in_legal_review, fully_executed, expired])
            db.flush()

            db.add_all(
                [
                    WorkflowEvent(
                        agreement_id=in_legal_review.id,
                        from_stage="draft_generated",
                        to_stage="legal_review",
                        action="generate_draft",
                        comment="Draft generated and routed to Legal for review.",
                        actor_id=users["linkages"].id,
                    ),
                    WorkflowEvent(
                        agreement_id=fully_executed.id,
                        from_stage="awaiting_signatures",
                        to_stage="fully_executed",
                        action="mark_fully_executed",
                        comment="Final signed scan uploaded.",
                        actor_id=users["linkages"].id,
                    ),
                    WorkflowEvent(
                        agreement_id=expired.id,
                        from_stage="fully_executed",
                        to_stage="expired",
                        action="expire",
                        comment="End date passed without renewal.",
                        actor_id=users["me"].id,
                    ),
                ]
            )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--empty", action="store_true", help="Create users only, without demo agreements")
    args = parser.parse_args()
    seed(reset=args.reset, demo=not args.empty)
    print("Database initialized.")
