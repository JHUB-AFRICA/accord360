import os
from pathlib import Path

TEST_DB = Path("test_accord360.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "true"

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_and_dashboard():
    login = client.post("/api/auth/login", json={"email": "linkages@accord360.app", "password": "Linkages@123"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    response = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "kpis" in response.json()


def test_partner_and_agreement_creation(monkeypatch):
    # GOOGLE_DOCS_DRAFTING_BRIEF.md Phase B: create_agreement calls the
    # Drive integration — no test may depend on real Google credentials.
    from app.modules.agreements import service as agreement_service

    monkeypatch.setattr(agreement_service.google_drive, "copy_template", lambda master_doc_id, name: "smoke-test-copy")
    monkeypatch.setattr(agreement_service.google_drive, "grant_permission", lambda doc_id, email, role="writer", notify=True, message=None: f"perm-{email}")
    monkeypatch.setattr(agreement_service.google_drive, "doc_url", lambda doc_id: f"https://docs.google.com/document/d/{doc_id}/edit")

    login = client.post("/api/auth/login", json={"email": "linkages@accord360.app", "password": "Linkages@123"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    partner = client.post(
        "/api/partners",
        headers=headers,
        json={"name": "Smoke Test Partner Unique", "sector": "Technology", "contact_email": "partner-smoke@example.org"},
    )
    assert partner.status_code in {201, 409}
    if partner.status_code == 409:
        partner_id = next(item["id"] for item in client.get("/api/partners", headers=headers).json() if item["name"] == "Smoke Test Partner Unique")
    else:
        partner_id = partner.json()["id"]

    researcher_login = client.post("/api/auth/login", json={"email": "researcher@accord360.app", "password": "Researcher@123"})
    assert researcher_login.status_code == 200
    researcher_headers = {"Authorization": f"Bearer {researcher_login.json()['access_token']}"}
    agreement = client.post(
        "/api/agreements",
        headers=researcher_headers,
        json={
            "title": "Smoke Test Agreement",
            "department": "ICT",
            "partner_id": partner_id,
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
        },
    )
    assert agreement.status_code == 201
    assert agreement.json()["status"] == "draft_generated"
