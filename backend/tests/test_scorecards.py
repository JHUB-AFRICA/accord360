from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models import Agreement, Deliverable, Partner, User, ValueRecord


client = TestClient(app)


def test_scorecards_are_persisted_scoped_and_recalculable():
    suffix = uuid4().hex[:8]
    email = f"scorecard-me-{suffix}@accord360.app"
    password = "Scorecard@123"
    with SessionLocal() as db:
        user = User(full_name="Scorecard M&E", email=email, password_hash=hash_password(password), role="me")
        partner = Partner(name=f"Scorecard Partner {suffix}", sector="Technology", country="Kenya")
        db.add_all([user, partner])
        db.flush()
        agreement = Agreement(reference_number=f"SCORE-{suffix}", title="Scorecard agreement", agreement_type="CRA", purpose="A sufficiently detailed scorecard collaboration purpose.", department="Computing", stage="active", status="active", status_color="green", owner_id=user.id, partner_id=partner.id)
        db.add(agreement)
        db.flush()
        db.add_all([
            Deliverable(agreement_id=agreement.id, deliverable_type="Research outputs", target_value=10, actual_value=5, evidence_document_id=1),
            ValueRecord(agreement_id=agreement.id, value_type="Research support", amount=100, currency="KES"),
        ])
        db.commit()

    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    listed = client.get("/api/scorecards", headers=headers)
    assert listed.status_code == 200
    record = next(item for item in listed.json() if item["agreement_id"] == agreement.id)
    assert record["snapshot"]["overall"] == 71
    assert record["snapshot"]["category"] == "Stable partnership"
    assert len(record["snapshot"]["components"]) == 4

    recalculated = client.post(f"/api/scorecards/{agreement.id}/recalculate", headers=headers)
    assert recalculated.status_code == 200
    history = client.get(f"/api/scorecards/{agreement.id}/history", headers=headers)
    assert history.status_code == 200
    assert len(history.json()) >= 2

    definitions = client.get("/api/scorecards/definitions", headers=headers)
    assert definitions.status_code == 200
    assert definitions.json()[0]["weights"]["deliverable_achievement"] == 50
