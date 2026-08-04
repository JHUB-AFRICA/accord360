import os
from datetime import date, timedelta
from pathlib import Path

TEST_DB = Path("test_accord360.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB}")
os.environ.setdefault("UPLOAD_DIR", "test_uploads")
os.environ.setdefault("SEED_DEMO_DATA", "true")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import Agreement, Partner, User
from app.services import refresh_risk_status
from app.timeutils import utc_now

client = TestClient(app)


def token(email: str, password: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def headers(email: str, password: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(email, password)}"}




def secondary_champion_id() -> int:
    admin_headers = headers("admin@accord360.app", "Admin@123")
    email = "secondary.champion@accord360.app"
    created = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "full_name": "Secondary Test Champion",
            "email": email,
            "password": "Secondary@123",
            "role": "researcher",
            "department": "ICT",
        },
    )
    if created.status_code == 201:
        return created.json()["id"]
    assert created.status_code == 409, created.text
    users = client.get("/api/users", headers=admin_headers).json()
    return next(item["id"] for item in users if item["email"] == email)


def create_linkages_owned_agreement(name: str) -> int:
    linkages_headers = headers("linkages@accord360.app", "Linkages@123")
    partner = client.post("/api/partners", headers=linkages_headers, json={"name": name, "sector": "Technology"})
    assert partner.status_code in {201, 409}
    if partner.status_code == 409:
        partners = client.get("/api/partners", headers=linkages_headers).json()
        partner_id = next(item["id"] for item in partners if item["name"] == name)
    else:
        partner_id = partner.json()["id"]
    agreement = client.post(
        "/api/agreements",
        headers=linkages_headers,
        json={
            "title": f"{name} Agreement",
            "agreement_type": "MoU",
            "purpose": "Validate role scope and secure records access.",
            "department": "ICT",
            "partner_id": partner_id,
            "champion_user_id": secondary_champion_id(),
        },
    )
    assert agreement.status_code == 201, agreement.text
    return agreement.json()["id"]


def test_researcher_cannot_read_or_update_another_users_record():
    agreement_id = create_linkages_owned_agreement("Scope Test Partner")
    researcher_headers = headers("researcher@accord360.app", "Research@123")
    assert client.get(f"/api/agreements/{agreement_id}", headers=researcher_headers).status_code == 403
    assert client.patch(
        f"/api/agreements/{agreement_id}",
        headers=researcher_headers,
        json={"title": "Unauthorized edit"},
    ).status_code == 403
    assert client.post(
        f"/api/agreements/{agreement_id}/deliverables",
        headers=researcher_headers,
        json={"deliverable_type": "Publications", "target_value": 1, "actual_value": 0},
    ).status_code == 403


def test_researcher_export_is_scoped():
    agreement_id = create_linkages_owned_agreement("Report Scope Partner")
    linkages_headers = headers("linkages@accord360.app", "Linkages@123")
    ref = client.get(f"/api/agreements/{agreement_id}", headers=linkages_headers).json()["reference_number"]
    response = client.get("/api/reports/agreements.csv", headers=headers("researcher@accord360.app", "Research@123"))
    assert response.status_code == 200
    assert ref not in response.text
    assert "Generated at (UTC)" in response.text


def test_activation_requires_signed_document_and_me_baseline():
    db = SessionLocal()
    try:
        linkages = db.scalar(select(User).where(User.role == "linkages"))
        partner = db.scalar(select(Partner).limit(1))
        agreement = Agreement(
            reference_number=f"JKUAT-CA-TEST-{utc_now().timestamp()}",
            title="Activation Control Test",
            agreement_type="CA",
            purpose="Test activation prerequisites and governance controls.",
            department="ICT",
            stage="validation_signing",
            status="fully_signed",
            status_color="green",
            owner_id=linkages.id,
            partner_id=partner.id,
            signing_date=date.today(),
            effective_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            internal_champion="Champion",
            partner_liaison="Liaison",
        )
        db.add(agreement)
        db.commit()
        db.refresh(agreement)
        agreement_id = agreement.id
    finally:
        db.close()

    response = client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=headers("linkages@accord360.app", "Linkages@123"),
        json={"action": "activate", "comment": "Activate"},
    )
    assert response.status_code == 400
    assert "deliverable" in response.json()["detail"]
    assert "signed agreement document" in response.json()["detail"]


def test_dormancy_rule_turns_active_agreement_red():
    agreement = Agreement(
        reference_number="UNIT-DORMANCY",
        title="Dormancy unit test",
        agreement_type="MoU",
        purpose="Validate M&E dormancy status logic.",
        department="ICT",
        stage="active",
        status="active",
        status_color="green",
        owner_id=1,
        partner_id=1,
        activated_at=utc_now() - timedelta(days=181),
        expiry_date=date.today() + timedelta(days=500),
    )
    agreement.deliverables = []
    refresh_risk_status(agreement)
    assert agreement.status == "dormant"
    assert agreement.status_color == "red"


def test_uploads_are_not_publicly_mounted():
    response = client.get("/uploads/nonexistent.pdf")
    assert response.status_code == 404

def test_confidential_document_metadata_and_download_are_scoped():
    agreement_id = create_linkages_owned_agreement("Confidential Document Partner")
    linkages_headers = headers("linkages@accord360.app", "Linkages@123")
    uploaded = client.post(
        f"/api/agreements/{agreement_id}/documents",
        headers=linkages_headers,
        data={"document_type": "draft", "version": "1.0", "confidentiality": "confidential", "is_official": "false"},
        files={"file": ("confidential-draft.txt", b"restricted", "text/plain")},
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    executive_headers = headers("executive@accord360.app", "Executive@123")
    detail = client.get(f"/api/agreements/{agreement_id}", headers=executive_headers)
    assert detail.status_code == 200
    assert all(doc["id"] != document_id for doc in detail.json()["documents"])
    download = client.get(
        f"/api/agreements/{agreement_id}/documents/{document_id}/download",
        headers=executive_headers,
    )
    assert download.status_code == 403
