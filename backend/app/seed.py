from __future__ import annotations

import argparse
from datetime import date, timedelta
from mimetypes import guess_type
from pathlib import Path

from sqlalchemy import delete, select

from .db.session import SessionLocal
from .models import Agreement, AuditLog, Document, Notification, Partner, Template, User, WorkflowEvent
from .core.config import settings
from .core.security import hash_password
from .timeutils import utc_now


# NOTE(rebuild-phase0): admin, approver, director_linkages, dvc, vc_office,
# executive and auditor accounts were removed per REBUILD_BRIEF.md Section 1 —
# only the four surviving roles (champion/researcher, linkages, legal, me) are
# seeded now. Renaming "researcher" -> "champion" is Phase 1 work.
DEFAULT_USERS = [
    ("JKUAT Champion", "researcher@accord360.app", "Research@123", "researcher", "Computing"),
    ("Linkages Officer", "linkages@accord360.app", "Linkages@123", "linkages", "Directorate of Linkages"),
    ("Legal Reviewer", "legal@accord360.app", "Legal@123", "legal", "Legal Office"),
    ("M&E Officer", "me@accord360.app", "Measure@123", "me", "M&E"),
]

SEEDED_TEMPLATES = [
    {
        "source_name": "Sample MoU (1).docx",
        "name": "JKUAT Standard Memorandum of Understanding",
        "agreement_type": "MoU",
        "version": "1.0",
        "description": "Editable Word draft for a Memorandum of Understanding.",
        "stored_name": "templates/seeded-jkuat-mou-v1.0.docx",
    },
    {
        "source_name": "Sample CRA (1).docx",
        "name": "JKUAT Standard Collaboration Agreement",
        "agreement_type": "CA",
        "version": "1.0",
        "description": "Editable Word draft for a Collaboration Agreement.",
        "stored_name": "templates/seeded-jkuat-ca-v1.0.docx",
    },
]


def seed_templates(db, admin: User) -> None:
    """Register the repository's initial editable Word templates once."""
    imports_path = Path(__file__).resolve().parents[1] / "data" / "imports"
    templates_path = settings.upload_path / "templates"

    for definition in SEEDED_TEMPLATES:
        source = imports_path / definition["source_name"]
        if not source.is_file():
            # A deployment without the optional import assets can still start.
            continue

        template = db.scalar(
            select(Template).where(
                Template.name == definition["name"],
                Template.version == definition["version"],
            )
        )
        target = settings.upload_path / definition["stored_name"]
        if not target.is_file():
            templates_path.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())

        if template is None:
            template = Template(
                name=definition["name"],
                agreement_type=definition["agreement_type"],
                version=definition["version"],
                description=definition["description"],
                status="active",
                original_name=source.name,
                stored_name=definition["stored_name"],
                mime_type=guess_type(source.name)[0] or "application/octet-stream",
                size_bytes=source.stat().st_size,
                uploaded_by_id=admin.id,
                created_at=utc_now(),
            )
            db.add(template)
        elif template.stored_name != definition["stored_name"] or not template.original_name:
            # Repair metadata/file placement if a prior seed was incomplete.
            template.original_name = source.name
            template.stored_name = definition["stored_name"]
            template.mime_type = guess_type(source.name)[0] or "application/octet-stream"
            template.size_bytes = source.stat().st_size

    db.flush()


def seed(reset: bool = False, demo: bool = True) -> None:
    db = SessionLocal()
    try:
        if reset:
            for model in [Notification, AuditLog, Document, WorkflowEvent, Agreement, Partner, Template, User]:
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

        seed_templates(db, users["linkages"])

        # NOTE(rebuild-phase0): the legacy compatibility block that migrated
        # old "ready_for_signing"/"awaiting_signature" rows into the rejected
        # 17-stage DVC/VC workflow was removed along with that workflow. The
        # new 9-status model's migration path is Phase 1 work.

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

            active = Agreement(
                reference_number="JKUAT-MOU-2026-0001",
                title="AI Research and Innovation Collaboration",
                agreement_type="MoU",
                purpose="Establish a framework for joint AI research, staff exchange and innovation activities.",
                expected_outcomes="Joint publications, workshops, student placements and funded research proposals.",
                strategic_alignment="Research, Innovation and Internationalization",
                department="School of Computing and Information Technology",
                stage="active",
                status="active",
                status_color="green",
                next_action="Update quarterly M&E outputs",
                owner_id=users["researcher"].id,
                partner_id=partner_a.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                internal_champion="Dr. Research Champion",
                partner_liaison="Global Partnerships Manager",
                effective_date=date.today() - timedelta(days=120),
                expiry_date=date.today() + timedelta(days=500),
                signing_date=date.today() - timedelta(days=125),
                activated_at=utc_now() - timedelta(days=120),
            )
            pipeline = Agreement(
                reference_number="JKUAT-CRA-2026-0001",
                title="Agricultural Data Collaboration Agreement",
                agreement_type="CRA",
                purpose="Enable secure collaboration on agricultural datasets and applied machine learning research.",
                expected_outcomes="Curated datasets, prototype decision-support tools and co-authored outputs.",
                strategic_alignment="Food Security and Digital Transformation",
                department="Department of Computing",
                stage="legal_review",
                status="in_legal_review",
                status_color="green",
                next_action="Legal reviewer to complete vetting",
                owner_id=users["researcher"].id,
                partner_id=partner_b.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                legal_review_started_at=utc_now() - timedelta(days=8),
                submitted_at=utc_now() - timedelta(days=18),
            )
            department_queue = Agreement(
                reference_number="JKUAT-MOU-2026-0002",
                title="County Innovation and Student Placement Partnership",
                agreement_type="MoU",
                purpose="Create a structured collaboration for student placements, applied innovation and county capacity building.",
                expected_outcomes="Student placements, innovation challenges and joint training sessions.",
                strategic_alignment="Student Experience and Community Engagement",
                department="Computing",
                stage="department_approval",
                status="pending_department",
                status_color="yellow",
                next_action="Department/faculty approver to review academic fit",
                owner_id=users["researcher"].id,
                partner_id=partner_b.id,
                submitted_at=utc_now() - timedelta(days=4),
            )
            dvc_queue = Agreement(
                reference_number="JKUAT-CA-2026-0002",
                title="Manufacturing Research Collaboration",
                agreement_type="CA",
                purpose="Establish a manufacturing research and technology-transfer collaboration.",
                expected_outcomes="Joint prototypes, industry attachments and commercialization studies.",
                strategic_alignment="Innovation and Industry Linkages",
                department="Computing",
                stage="dvc_approval",
                status="legal_approved",
                status_color="green",
                next_action="DVC RPE endorsement required",
                owner_id=users["researcher"].id,
                partner_id=partner_a.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                submitted_at=utc_now() - timedelta(days=20),
                legal_review_started_at=utc_now() - timedelta(days=12),
            )
            vc_queue = Agreement(
                reference_number="JKUAT-CRA-2026-0002",
                title="Climate Data and Resilience Collaboration",
                agreement_type="CRA",
                purpose="Support joint climate-data research, student projects and resilience analytics.",
                expected_outcomes="Shared datasets, research outputs and policy briefs.",
                strategic_alignment="Climate Resilience and Research",
                department="Computing",
                stage="vc_submission",
                status="dvc_approved",
                status_color="green",
                next_action="Linkages to submit the endorsed package to VC Office",
                owner_id=users["researcher"].id,
                partner_id=partner_b.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                submitted_at=utc_now() - timedelta(days=25),
            )
            signing_queue = Agreement(
                reference_number="JKUAT-MOU-2026-0003",
                title="International Exchange and Joint Training MoU",
                agreement_type="MoU",
                purpose="Coordinate staff exchange, joint short courses and student mobility.",
                expected_outcomes="Exchange visits, joint courses and mobility opportunities.",
                strategic_alignment="Internationalization",
                department="Computing",
                stage="validation_signing",
                status="awaiting_vc_signature",
                status_color="yellow",
                next_action="VC Office to record signature milestone",
                owner_id=users["researcher"].id,
                partner_id=partner_a.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                date_sent_vc=date.today() - timedelta(days=3),
            )
            dormant = Agreement(
                reference_number="JKUAT-CA-2025-0004",
                title="Digital Skills Implementation Partnership",
                agreement_type="CA",
                purpose="Deliver digital-skills activities and applied learning opportunities.",
                expected_outcomes="Training cohorts, mentorship activities and project outputs.",
                strategic_alignment="Digital Transformation",
                department="Computing",
                stage="active",
                status="active",
                status_color="green",
                next_action="Submit the next six-month M&E report",
                owner_id=users["researcher"].id,
                partner_id=partner_b.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                internal_champion="JKUAT Champion",
                partner_liaison="Partner Programme Lead",
                effective_date=date.today() - timedelta(days=400),
                expiry_date=date.today() + timedelta(days=300),
                signing_date=date.today() - timedelta(days=405),
                activated_at=utc_now() - timedelta(days=190),
            )
            db.add_all([active, pipeline, department_queue, dvc_queue, vc_queue, signing_queue, dormant])
            db.flush()

            # NOTE(rebuild-phase0): demo Deliverable/ValueRecord rows were
            # removed along with those models (REBUILD_BRIEF.md Section 1).
            db.add_all(
                [
                    WorkflowEvent(agreement_id=active.id, from_stage="validation_signing", to_stage="active", action="activate", comment="Agreement activated after full signature.", actor_id=users["linkages"].id),
                    WorkflowEvent(agreement_id=pipeline.id, from_stage="linkages_review", to_stage="legal_review", action="send_legal", comment="Request passed completeness and strategic-fit review.", actor_id=users["linkages"].id),
                    WorkflowEvent(agreement_id=department_queue.id, from_stage="initiation", to_stage="department_approval", action="submit", comment="Champion submitted the request.", actor_id=users["researcher"].id),
                    WorkflowEvent(agreement_id=dvc_queue.id, from_stage="legal_review", to_stage="dvc_approval", action="approve_legal", comment="Legal version approved and locked.", actor_id=users["legal"].id),
                    WorkflowEvent(agreement_id=vc_queue.id, from_stage="dvc_approval", to_stage="vc_submission", action="approve_dvc", comment="DVC RPE endorsed the package.", actor_id=users["linkages"].id),
                    WorkflowEvent(agreement_id=signing_queue.id, from_stage="vc_submission", to_stage="validation_signing", action="submit_vc", comment="Endorsed package submitted to VC Office.", actor_id=users["linkages"].id),
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
