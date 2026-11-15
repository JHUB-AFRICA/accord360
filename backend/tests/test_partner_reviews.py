from __future__ import annotations

import os
from pathlib import Path

# Never touch the developer's real database: tests always run on their own
# throwaway SQLite file (set before app.main is imported).
_TEST_DB = Path("test_partner_reviews.db")
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
from app.modules.partners.models import Partner, PartnerReviewEvent
from app.modules.users.models import User


client = TestClient(app)


def _ensure_user(email: str, role: str, password: str) -> None:
    with SessionLocal() as db:
        if not db.query(User).filter_by(email=email).first():
            db.add(User(full_name=f"{role.title()} Reviewer", email=email, password_hash=hash_password(password), role=role))
            db.commit()


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_partner_review_decision_and_history_are_persisted():
    password = "Linkages@123"
    email = "review-linkages@accord360.app"
    _ensure_user(email, "linkages", password)
    name = f"Review Partner {uuid4().hex[:8]}"
    with SessionLocal() as db:
        partner = Partner(name=name, sector="Research", status="under_review")
        db.add(partner)
        db.commit()
        partner_id = partner.id

    headers = _login(email, password)
    decision = client.post(
        f"/api/partners/{partner_id}/review",
        headers=headers,
        json={"status": "additional_information_required", "reason": "Registration evidence is incomplete."},
    )
    assert decision.status_code == 201
    assert decision.json()["old_status"] == "under_review"
    assert decision.json()["new_status"] == "additional_information_required"
    assert decision.json()["reason"] == "Registration evidence is incomplete."
    assert decision.json()["reviewer"]["email"] == email

    history = client.get(f"/api/partners/{partner_id}/reviews", headers=headers)
    assert history.status_code == 200
    assert len(history.json()) == 1

    with SessionLocal() as db:
        assert db.get(Partner, partner_id).status == "additional_information_required"
        assert db.query(PartnerReviewEvent).filter_by(partner_id=partner_id).one().reason == "Registration evidence is incomplete."


def test_partner_review_history_requires_review_role():
    password = "Researcher@123"
    email = "review-researcher@accord360.app"
    _ensure_user(email, "researcher", password)
    with SessionLocal() as db:
        partner = db.query(Partner).first()
        partner_id = partner.id

    response = client.get(f"/api/partners/{partner_id}/reviews", headers=_login(email, password))
    assert response.status_code == 403
