from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.modules.agreements.models import Agreement
from app.modules.partners.models import Partner
from app.modules.users.models import User
from app.modules.workflows.models import Correction

client = TestClient(app)


def _setup_records() -> dict[str, int]:
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        researcher = User(full_name="Correction Champion", email=f"champion-{suffix}@example.org", password_hash=hash_password("Research@123"), role="researcher", department="Computing")
        legal = User(full_name="Correction Legal Reviewer", email=f"legal-{suffix}@example.org", password_hash=hash_password("Legal@123"), role="legal", department="Legal")
        approver = User(full_name="Correction Approver", email=f"approver-{suffix}@example.org", password_hash=hash_password("Approver@123"), role="approver", department="Computing")
        partner = Partner(name=f"Correction Partner {suffix}", sector="Research", partner_type="University", country="Kenya")
        db.add_all([researcher, legal, approver, partner])
        db.flush()
        agreement = Agreement(
            reference_number=f"JKUAT-MOU-TEST-{suffix}",
            title="Correction workflow test agreement",
            agreement_type="MoU",
            purpose="A correction workflow agreement used by the focused API tests.",
            department="Computing",
            stage="legal_review",
            status="in_legal_review",
            status_color="green",
            next_action="Legal Office review in progress",
            confidentiality="internal",
            owner_id=researcher.id,
            partner_id=partner.id,
            assigned_approver_id=approver.id,
            legal_reviewer_id=legal.id,
            internal_champion=researcher.full_name,
        )
        db.add(agreement)
        db.commit()
        return {"researcher": researcher.id, "legal": legal.id, "approver": approver.id, "agreement": agreement.id, "suffix": suffix}


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_return_creates_structured_correction_and_response_can_resolve():
    ids = _setup_records()
    with SessionLocal() as db:
        users = {user.role: user.email for user in db.query(User).filter(User.id.in_([ids["researcher"], ids["legal"], ids["approver"]])).all()}

    legal_headers = _login(users["legal"], "Legal@123")
    returned = client.post(
        f"/api/agreements/{ids['agreement']}/transition",
        headers=legal_headers,
        json={
            "action": "return_correction",
            "comment": "LEGAL CORRECTION\nExact item: Clause 7.2\nRequested change: Clarify the intellectual property language.",
            "exact_item": "Clause 7.2 — Intellectual Property",
            "requested_change": "Clarify the intellectual property language.",
            "details": "Use the approved institutional wording.",
        },
    )
    assert returned.status_code == 200

    researcher_headers = _login(users["researcher"], "Research@123")
    corrections = client.get("/api/corrections", headers=researcher_headers)
    assert corrections.status_code == 200 and len(corrections.json()) == 1
    correction = corrections.json()[0]
    assert correction["status"] == "pending"
    assert correction["exact_item"] == "Clause 7.2 — Intellectual Property"

    response = client.post(
        f"/api/corrections/{correction['id']}/respond",
        headers=researcher_headers,
        json={"response_text": "Updated the clause with the approved wording."},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "responded"

    resolved = client.post(
        f"/api/corrections/{correction['id']}/resolve",
        headers=legal_headers,
        json={"resolution_notes": "Reviewed the updated clause and confirmed the correction."},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"


def test_correction_response_is_role_scoped():
    ids = _setup_records()
    with SessionLocal() as db:
        legal = db.get(User, ids["legal"])
        approver = db.get(User, ids["approver"])
        legal_headers = _login(legal.email, "Legal@123")
        approver_headers = _login(approver.email, "Approver@123")

    returned = client.post(
        f"/api/agreements/{ids['agreement']}/transition",
        headers=legal_headers,
        json={"action": "return_correction", "comment": "Return for correction."},
    )
    assert returned.status_code == 200
    correction_id = client.get("/api/corrections", headers=legal_headers).json()[0]["id"]
    denied = client.post(
        f"/api/corrections/{correction_id}/respond",
        headers=approver_headers,
        json={"response_text": "Unauthorized response."},
    )
    assert denied.status_code == 403


def test_correction_model_is_linked_to_workflow_event():
    ids = _setup_records()
    with SessionLocal() as db:
        legal = db.get(User, ids["legal"])
        headers = _login(legal.email, "Legal@123")
    response = client.post(
        f"/api/agreements/{ids['agreement']}/transition",
        headers=headers,
        json={"action": "return_correction", "comment": "Return for correction."},
    )
    assert response.status_code == 200
    with SessionLocal() as db:
        correction = db.query(Correction).filter_by(agreement_id=ids["agreement"]).one()
        assert correction.workflow_event_id
        assert correction.return_action == "return_correction"
