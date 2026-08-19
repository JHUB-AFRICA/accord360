from __future__ import annotations

import argparse
from datetime import date, timedelta

from sqlalchemy import delete, select

from .db.session import SessionLocal
from .models import Agreement, AuditLog, Deliverable, Document, Notification, Partner, User, ValueRecord, WorkflowEvent
from .core.security import hash_password
from .timeutils import utc_now


DEFAULT_USERS = [
    ("System Administrator", "admin@accord360.app", "Admin@123", "admin", "JHUB Africa"),
    ("JKUAT Champion", "researcher@accord360.app", "Research@123", "researcher", "Computing"),
    ("Faculty Approver", "approver@accord360.app", "Approver@123", "approver", "Computing"),
    ("Linkages Officer", "linkages@accord360.app", "Linkages@123", "linkages", "Directorate of Linkages"),
    ("Director of Linkages", "director.linkages@accord360.app", "Director@123", "director_linkages", "Directorate of Linkages"),
    ("Legal Reviewer", "legal@accord360.app", "Legal@123", "legal", "Legal Office"),
    ("DVC RPE", "dvc.rpe@accord360.app", "DvcRpe@123", "dvc", "DVC RPE Office"),
    ("VC Office Signing Desk", "vc.office@accord360.app", "VcOffice@123", "vc_office", "Vice Chancellor Office"),
    ("Executive Viewer", "executive@accord360.app", "Executive@123", "executive", "RPE"),
    ("M&E Officer", "me@accord360.app", "Measure@123", "me", "M&E"),
    ("Audit Reviewer", "auditor@accord360.app", "Auditor@123", "auditor", "Internal Audit"),
]


def seed(reset: bool = False, demo: bool = True) -> None:
    db = SessionLocal()
    try:
        if reset:
            for model in [Notification, AuditLog, Deliverable, ValueRecord, Document, WorkflowEvent, Agreement, Partner, User]:
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

        # Lightweight compatibility update for databases created before the DVC/VC role gates.
        legacy_ready = db.scalars(select(Agreement).where(Agreement.status == "ready_for_signing")).all()
        for agreement in legacy_ready:
            agreement.stage = "dvc_approval"
            agreement.status = "legal_approved"
            agreement.status_color = "green"
            agreement.next_action = "DVC RPE endorsement required"
        legacy_signing = db.scalars(select(Agreement).where(Agreement.status == "awaiting_signature")).all()
        for agreement in legacy_signing:
            agreement.stage = "validation_signing"
            agreement.status = "awaiting_vc_signature"
            agreement.status_color = "yellow"
            agreement.next_action = "VC Office to record signature milestone"

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
                assigned_approver_id=users["approver"].id,
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
                assigned_approver_id=users["approver"].id,
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
                assigned_approver_id=users["approver"].id,
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
                assigned_approver_id=users["approver"].id,
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
                assigned_approver_id=users["approver"].id,
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
                assigned_approver_id=users["approver"].id,
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
                assigned_approver_id=users["approver"].id,
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

            db.add_all(
                [
                    Deliverable(agreement_id=active.id, deliverable_type="Internships", target_value=10, actual_value=6, reporting_period="2026"),
                    Deliverable(agreement_id=active.id, deliverable_type="Publications", target_value=4, actual_value=2, reporting_period="2026"),
                    ValueRecord(agreement_id=active.id, value_type="Research grant", amount=2_500_000, currency="KES", source="Joint project", reporting_period="2026"),
                    WorkflowEvent(agreement_id=active.id, from_stage="validation_signing", to_stage="active", action="activate", comment="Agreement activated after full signature.", actor_id=users["linkages"].id),
                    WorkflowEvent(agreement_id=pipeline.id, from_stage="linkages_review", to_stage="legal_review", action="send_legal", comment="Request passed completeness and strategic-fit review.", actor_id=users["linkages"].id),
                    WorkflowEvent(agreement_id=department_queue.id, from_stage="initiation", to_stage="department_approval", action="submit", comment="Champion submitted the request.", actor_id=users["researcher"].id),
                    WorkflowEvent(agreement_id=dvc_queue.id, from_stage="legal_review", to_stage="dvc_approval", action="approve_legal", comment="Legal version approved and locked.", actor_id=users["legal"].id),
                    WorkflowEvent(agreement_id=vc_queue.id, from_stage="dvc_approval", to_stage="vc_submission", action="approve_dvc", comment="DVC RPE endorsed the package.", actor_id=users["dvc"].id),
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
