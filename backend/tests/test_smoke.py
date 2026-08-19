import os
from pathlib import Path

TEST_DB = Path("test_accord360.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"
os.environ["ENVIRONMENT"] = "test"

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
    login = client.post("/api/auth/login", json={"email": "linkages@accord360.app", "password": "Linkages@123"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    partner = client.post("/api/partners", headers=headers, json={"name": "Smoke Test Partner Unique", "sector": "Technology"})
    assert partner.status_code in {201, 409}
    if partner.status_code == 409:
        partner_id = next(item["id"] for item in client.get("/api/partners", headers=headers).json() if item["name"] == "Smoke Test Partner Unique")
    else:
        partner_id = partner.json()["id"]
    champions = client.get("/api/users/champions", headers=headers)
    assert champions.status_code == 200 and champions.json()
    agreement = client.post(
        "/api/agreements",
        headers=headers,
        json={
            "title": "Smoke Test Agreement",
            "agreement_type": "MoU",
            "purpose": "Test end-to-end agreement creation.",
            "department": "ICT",
            "partner_id": partner_id,
            "champion_user_id": champions.json()[0]["id"],
        },
    )
    assert agreement.status_code == 201
    assert agreement.json()["reference_number"].startswith("JKUAT-MOU")
