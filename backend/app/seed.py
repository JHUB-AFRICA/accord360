from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select

from .database import Base, SessionLocal, engine
from .models import Agreement, AuditLog, Deliverable, Document, Notification, Partner, User, ValueRecord, WorkflowEvent
from .security import hash_password


DEFAULT_USERS = [
    ("System Administrator", "admin@accord360.app", "Admin@123", "admin", "JHUB Africa"),
    ("Researcher Demo", "researcher@accord360.app", "Research@123", "researcher", "Computing"),
    ("Faculty Approver", "approver@accord360.app", "Approver@123", "approver", "Computing"),
    ("Linkages Officer", "linkages@accord360.app", "Linkages@123", "linkages", "Directorate of Linkages"),
    ("Legal Reviewer", "legal@accord360.app", "Legal@123", "legal", "Legal Office"),
    ("Executive Viewer", "executive@accord360.app", "Executive@123", "executive", "RPE"),
    ("M&E Officer", "me@accord360.app", "Measure@123", "me", "M&E"),
]


def seed(reset: bool = False, demo: bool = True) -> None:
    Base.metadata.create_all(bind=engine)
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
                activated_at=datetime.utcnow() - timedelta(days=120),
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
                legal_review_started_at=datetime.utcnow() - timedelta(days=8),
                submitted_at=datetime.utcnow() - timedelta(days=18),
            )
            db.add_all([active, pipeline])
            db.flush()

            db.add_all(
                [
                    Deliverable(agreement_id=active.id, deliverable_type="Internships", target_value=10, actual_value=6, reporting_period="2026"),
                    Deliverable(agreement_id=active.id, deliverable_type="Publications", target_value=4, actual_value=2, reporting_period="2026"),
                    ValueRecord(agreement_id=active.id, value_type="Research grant", amount=2_500_000, currency="KES", source="Joint project", reporting_period="2026"),
                    WorkflowEvent(agreement_id=active.id, from_stage="validation_signing", to_stage="active", action="activate", comment="Agreement activated after full signature.", actor_id=users["linkages"].id),
                    WorkflowEvent(agreement_id=pipeline.id, from_stage="linkages_review", to_stage="legal_review", action="send_legal", comment="Request passed completeness and strategic-fit review.", actor_id=users["linkages"].id),
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
