from __future__ import annotations

import os
from pathlib import Path

# Never touch the developer's real database: tests always run on their own
# throwaway SQLite file (set before app.main is imported).
_TEST_DB = Path("test_agreement_visibility.db")
if _TEST_DB.exists():
    _TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "true"


from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models import Agreement, Partner, User


client = TestClient(app)


def test_researcher_sees_owned_or_initiated_agreements_only():
    suffix = uuid4().hex[:8]
    first_email = f"visibility-first-{suffix}@accord360.app"
    second_email = f"visibility-second-{suffix}@accord360.app"
    password = "Visibility@123"
    with SessionLocal() as db:
        first = User(full_name="First Researcher", email=first_email, password_hash=hash_password(password), role="researcher")
        second = User(full_name="Second Researcher", email=second_email, password_hash=hash_password(password), role="researcher")
        partner = Partner(name=f"Visibility Partner {suffix}", sector="Technology", country="Kenya")
        db.add_all([first, second, partner])
        db.flush()
        owned = Agreement(reference_number=f"VIS-{suffix}-OWN", title="Owned partnership", agreement_type="MoU", purpose="A sufficiently detailed visibility test purpose.", department="Computing", stage="active", status="active", status_color="green", owner_id=first.id, initiator_id=second.id, partner_id=partner.id)
        other = Agreement(reference_number=f"VIS-{suffix}-OTHER", title="Other partnership", agreement_type="CRA", purpose="A sufficiently detailed unrelated visibility purpose.", department="Computing", stage="active", status="active", status_color="green", owner_id=second.id, initiator_id=second.id, partner_id=partner.id)
        db.add_all([owned, other])
        db.flush()
        other_id = other.id
        db.commit()

    login = client.post("/api/auth/login", json={"email": first_email, "password": password})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get("/api/agreements", headers=headers)
    assert response.status_code == 200
    references = {item["reference_number"] for item in response.json()}
    assert f"VIS-{suffix}-OWN" in references
    assert f"VIS-{suffix}-OTHER" not in references

    hidden = client.get(f"/api/agreements/{other_id}", headers=headers)
    assert hidden.status_code == 404
