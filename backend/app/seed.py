from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select

from .database import Base, SessionLocal, engine
from .models import (
    Agreement,
    FAQEntry,
    ScorecardCriterion,
    AuditLog,
    Deliverable,
    Document,
    LegalFeedback,
    MEReportSchedule,
    Notification,
    Partner,
    PartnerCategory,
    PartnerRequest,
    Template,
    User,
    ValueRecord,
    WorkflowEvent,
)
from .security import hash_password

DEFAULT_USERS = [
    ("System Administrator", "admin@accord360.app", "Admin@123", "admin", "JHUB Africa"),
    ("JKUAT Champion", "champion@accord360.app", "Champion@123", "champion", "School of Computing and IT"),
    ("Linkages Officer", "linkages@accord360.app", "Linkages@123", "linkages", "Directorate of Linkages"),
    ("Legal Reviewer", "legal@accord360.app", "Legal@123", "legal", "Legal Office"),
    ("DVC RPE", "dvc@accord360.app", "DvcRpe@123", "dvc", "Research, Production and Extension"),
    ("VC Office", "vc@accord360.app", "VcOffice@123", "vc_office", "Office of the Vice Chancellor"),
    ("Executive Viewer", "executive@accord360.app", "Executive@123", "executive", "RPE"),
    ("M&E Officer", "me@accord360.app", "Measure@123", "me", "M&E"),
]

# Appendix A partner categories
DEFAULT_CATEGORIES = [
    ("University / Higher Education Institution", "MoU, CRA, exchange and research collaboration templates."),
    ("Country Government", "MoU, CA and implementation framework templates."),
    ("County Government", "MoU, local implementation and community outreach templates."),
    ("Manufacturing Industry", "MoU, CA, internship/attachment and consultancy templates."),
    ("NGO / Development Partner", "MoU, project collaboration and grant support templates."),
    ("Other / Custom", "Admin-defined templates for future partner categories."),
]

# Appendix B default scorecard weights (total 100)
DEFAULT_CRITERIA = [
    ("deliverables", "Deliverable attainment", "Actual outputs versus agreed targets.", 25, 1),
    ("activity", "Activity reporting", "Six-month report compliance for periods due.", 20, 2),
    ("financial", "Financial value", "Approved value generated within the last year.", 15, 3),
    ("strategic", "Strategic alignment", "Documented alignment to institutional strategy.", 10, 4),
    ("engagement", "Engagement freshness", "Recency of M&E updates and interactions.", 10, 5),
    ("compliance", "Compliance", "No overdue reports and agreement within validity.", 10, 6),
    ("qualitative", "Qualitative assessment", "Manual score by Linkages / M&E with narrative note.", 10, 7),
]

DEFAULT_FAQS = [
    ("How do I start a new partnership or MoU with JKUAT?", "If you are JKUAT staff, log in as a Champion and create a new agreement request, or contact the Directorate of Linkages. External partners should write to linkages@jkuat.ac.ke; Linkages will log your request and assign an internal JKUAT Champion before drafting begins.", "start,begin,new,partnership,mou,initiate,create,request", "Getting started"),
    ("What is the difference between an MoU, CRA and CA?", "An MoU (Memorandum of Understanding) sets a broad cooperation framework. A CRA (Collaborative Research Agreement) governs a specific joint research project including funding and data. A CA (Collaboration Agreement) covers defined joint activities such as internships or consultancy. The template library provides approved language for each type per partner category.", "difference,mou,cra,ca,type,types,agreement,memorandum", "Agreement types"),
    ("Who is a JKUAT Champion?", "The JKUAT Champion is the internal staff member responsible for an agreement: they initiate and push the process, respond to legal feedback, and submit six-month activity reports once the agreement is active. Every partner-originated request must have a Champion assigned before drafting can start.", "champion,who,internal,owner,responsible", "Roles"),
    ("How long does legal review take?", "The Legal Office works within a 21-day service window for reviewing drafts. The system flags any legal review that exceeds 21 days so it can be escalated by Linkages.", "legal,review,long,days,duration,sla,time", "Workflow"),
    ("What approvals are needed before the Vice Chancellor signs?", "Two gates must be completed first: the Legal Office must record approval of the draft, and the DVC for Research, Production and Extension must sign off. Only then can Linkages submit the package to the VC Office — the system blocks earlier submission.", "vc,vice,chancellor,dvc,approval,sign,gate,submission,package", "Workflow"),
    ("Are there templates I can use?", "Yes. The template library holds approved templates organised by agreement type and partner category (universities, country and county government, manufacturing, NGOs and custom categories). When you create a request, the wizard recommends matching templates and records the exact version used.", "template,templates,library,category,standard,draft", "Templates"),
    ("What reporting is required after signing?", "Every active agreement has an automatic six-month reporting schedule. The JKUAT Champion submits activities, outcomes and challenges each period; M&E or Linkages validate the report. Champions receive alerts before each due date.", "report,reporting,six,month,m&e,monitoring,activity,after,active", "Monitoring"),
    ("How are partnerships scored?", "Each active partnership gets a weighted scorecard: deliverable attainment (25%), activity reporting (20%), financial value (15%), strategic alignment (10%), engagement (10%), compliance (10%) and a qualitative assessment (10%). Administrators can adjust the weights.", "score,scorecard,performance,rating,weights,grade", "Monitoring"),
    ("What happens when an agreement is about to expire?", "The system warns Linkages and executives six months before expiry and escalates at 90 days. Linkages then starts a renewal review or closure decision; renewed agreements continue with a fresh reporting schedule.", "expire,expiry,renew,renewal,close,end,extension", "Renewal"),
    ("How do I contact the Directorate of Linkages?", "Email linkages@jkuat.ac.ke or visit the Directorate of Linkages at JKUAT Main Campus, Juja. For legal questions about a specific draft, use the legal feedback thread on the agreement.", "contact,email,phone,reach,office,help,support", "Contact"),
]

DEFAULT_TEMPLATES = [
    ("Standard University MoU", "MoU", "University / Higher Education Institution",
     "Framework MoU for research collaboration, staff/student mobility, joint publications and IP clauses."),
    ("University Collaborative Research Agreement", "CRA", "University / Higher Education Institution",
     "Structured CRA covering research scope, funding, data sharing and publication rights."),
    ("Manufacturing Industry MoU", "MoU", "Manufacturing Industry",
     "MoU for internships, industrial attachments, equipment/lab support and consultancy pipelines."),
    ("Manufacturing Collaboration Agreement", "CA", "Manufacturing Industry",
     "CA covering site access, safety/compliance, internship intakes and consultancy outputs."),
    ("County Government MoU", "MoU", "County Government",
     "MoU for local implementation scope, county liaison and community beneficiary programmes."),
    ("Country Government Cooperation Agreement", "CA", "Country Government",
     "CA aligning ministry mandate, authorized signatories and policy commitments."),
]


def seed(reset: bool = False, demo: bool = True) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if reset:
            for model in [Notification, AuditLog, ScorecardCriterion, FAQEntry, MEReportSchedule, LegalFeedback, Deliverable, ValueRecord, Document, WorkflowEvent, PartnerRequest, Agreement, Template, PartnerCategory, Partner, User]:
                db.execute(delete(model))
            db.commit()

        users: dict[str, User] = {}
        for full_name, email, password, role, department in DEFAULT_USERS:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(full_name=full_name, email=email, password_hash=hash_password(password), role=role, department=department)
                db.add(user)
                db.flush()
            users[role] = user

        for name, description in DEFAULT_CATEGORIES:
            if not db.scalar(select(PartnerCategory).where(PartnerCategory.name == name)):
                db.add(PartnerCategory(name=name, description=description))
        db.flush()

        for key, label, description, weight, order in DEFAULT_CRITERIA:
            if not db.scalar(select(ScorecardCriterion).where(ScorecardCriterion.key == key)):
                db.add(ScorecardCriterion(key=key, label=label, description=description, weight=weight, sort_order=order))
        for question, answer, keywords, category in DEFAULT_FAQS:
            if not db.scalar(select(FAQEntry).where(FAQEntry.question == question)):
                db.add(FAQEntry(question=question, answer=answer, keywords=keywords, category=category))
        db.flush()

        for name, agreement_type, category, description in DEFAULT_TEMPLATES:
            if not db.scalar(select(Template).where(Template.name == name)):
                db.add(Template(
                    name=name,
                    agreement_type=agreement_type,
                    partner_category=category,
                    description=description,
                    body=f"[{agreement_type} template body for {category}. Edit in the Template Library.]",
                    created_by_id=users["admin"].id,
                ))
        db.flush()

        if demo and not db.scalar(select(Agreement.id).limit(1)):
            partner_a = Partner(
                name="Technical University of Munich",
                sector="Higher Education",
                partner_type="University",
                category="University / Higher Education Institution",
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
                category="Country Government",
                country="Kenya",
                contact_name="Research Partnerships Office",
                contact_email="research@example.org",
                liaison="Senior ICT Officer",
            )
            db.add_all([partner_a, partner_b])
            db.flush()

            mou_template = db.scalar(select(Template).where(Template.name == "Standard University MoU"))
            active = Agreement(
                reference_number="JKUAT-MOU-2026-0001",
                title="AI Research and Innovation Collaboration",
                agreement_type="MoU",
                purpose="Establish a framework for joint AI research, staff exchange and innovation activities.",
                expected_outcomes="Joint publications, workshops, student placements and funded research proposals.",
                strategic_alignment="Research, Innovation and Internationalization",
                department="School of Computing and Information Technology",
                source="champion",
                partner_category="University / Higher Education Institution",
                template_id=mou_template.id if mou_template else None,
                template_version=mou_template.version if mou_template else None,
                stage="active",
                status="active",
                status_color="green",
                next_action="Update quarterly M&E outputs",
                owner_id=users["champion"].id,
                partner_id=partner_a.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                partner_liaison="Global Partnerships Manager",
                effective_date=date.today() - timedelta(days=120),
                expiry_date=date.today() + timedelta(days=500),
                signing_date=date.today() - timedelta(days=125),
                legal_approved_at=datetime.utcnow() - timedelta(days=140),
                legal_approved_by_id=users["legal"].id,
                dvc_signed_at=datetime.utcnow() - timedelta(days=135),
                dvc_signed_by_id=users["dvc"].id,
                vc_submitted_at=datetime.utcnow() - timedelta(days=130),
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
                source="partner",
                partner_category="Country Government",
                stage="legal_review",
                status="in_legal_review",
                status_color="green",
                next_action="Legal reviewer to complete vetting",
                owner_id=users["champion"].id,
                partner_id=partner_b.id,
                assigned_linkages_id=users["linkages"].id,
                legal_reviewer_id=users["legal"].id,
                legal_review_started_at=datetime.utcnow() - timedelta(days=8),
                submitted_at=datetime.utcnow() - timedelta(days=18),
            )
            db.add_all([active, pipeline])
            db.flush()

            intake = PartnerRequest(
                partner_name="Nairobi Precision Manufacturing Ltd",
                sector="Manufacturing",
                category="Manufacturing Industry",
                country="Kenya",
                county="Nairobi",
                collaboration_area="Industrial attachments, joint prototyping lab and staff consultancy engagements.",
                contact_name="Head of Innovation",
                contact_email="innovation@example.org",
                status="logged",
                logged_by_id=users["linkages"].id,
            )
            db.add(intake)

            db.add_all([
                MEReportSchedule(agreement_id=active.id, period_label="Six-month report 1 (Jan 2026)", due_date=date.today() - timedelta(days=30), status="validated", activities="Joint AI workshop series and 6 internships placed.", outcomes="2 co-authored papers drafted.", submitted_by_id=users["champion"].id, submitted_at=datetime.utcnow() - timedelta(days=35), validated_by_id=users["me"].id, validated_at=datetime.utcnow() - timedelta(days=28)),
                MEReportSchedule(agreement_id=active.id, period_label="Six-month report 2 (Jul 2026)", due_date=date.today() + timedelta(days=14), status="pending"),
                LegalFeedback(agreement_id=pipeline.id, author_id=users["legal"].id, message="Clause 6 (data ownership) needs alignment with the Data Protection Act. Please confirm the data categories shared.", document_version="1.0"),
                Deliverable(agreement_id=active.id, deliverable_type="Internships", target_value=10, actual_value=6, reporting_period="2026"),
                Deliverable(agreement_id=active.id, deliverable_type="Publications", target_value=4, actual_value=2, reporting_period="2026"),
                ValueRecord(agreement_id=active.id, value_type="Research grant", amount=2_500_000, currency="KES", source="Joint project", reporting_period="2026"),
                WorkflowEvent(agreement_id=active.id, from_stage="signing", to_stage="active", action="activate", comment="Agreement activated after full signature.", actor_id=users["linkages"].id),
                WorkflowEvent(agreement_id=pipeline.id, from_stage="linkages_review", to_stage="legal_review", action="send_legal", comment="Request passed completeness and strategic-fit review.", actor_id=users["linkages"].id),
            ])
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
