import os
from pathlib import Path

TEST_DB = Path("test_accord360.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_and_dashboard():
    login = client.post("/api/auth/login", json={"email": "admin@accord360.app", "password": "Admin@123"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    response = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "kpis" in response.json()


def test_partner_and_agreement_creation():
    login = client.post("/api/auth/login", json={"email": "admin@accord360.app", "password": "Admin@123"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    partner = client.post("/api/partners", headers=headers, json={"name": "Smoke Test Partner", "sector": "Technology"})
    assert partner.status_code == 201
    agreement = client.post(
        "/api/agreements",
        headers=headers,
        json={
            "title": "Smoke Test Agreement",
            "agreement_type": "MoU",
            "purpose": "Test end-to-end agreement creation.",
            "department": "ICT",
            "partner_id": partner.json()["id"],
        },
    )
    assert agreement.status_code == 201
    assert agreement.json()["reference_number"].startswith("JKUAT-MOU")
