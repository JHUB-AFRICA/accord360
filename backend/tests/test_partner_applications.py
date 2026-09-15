from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password
from app.modules.partners import service
from app.modules.partners.models import Partner, PartnerApplication
from app.modules.users.models import User

client = TestClient(app)

with SessionLocal() as _db:
    if not _db.query(User).filter_by(email="linkages@accord360.app").first():
        _db.add(
            User(
                full_name="Linkages Officer",
                email="linkages@accord360.app",
                password_hash=hash_password("Linkages@123"),
                role="linkages",
                department="Directorate of Linkages",
            )
        )
        _db.commit()


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _registration_payload() -> tuple[dict[str, str], dict[str, tuple[str, bytes, str]]]:
    suffix = uuid4().hex[:8]
    fields = {
        "institution_name": f"Prototype Partner {suffix}",
        "institution_type": "University",
        "country": "Kenya",
        "region": "Kiambu",
        "website": "https://prototype.example.org",
        "registration_number": f"REG-{suffix}",
        "contact_name": "Amina Test",
        "job_title": "Director of Partnerships",
        "official_email": f"contact-{suffix}@prototype.example.org",
        "phone": "+254700000000",
        "collaboration_area": "Joint research and student innovation programme",
        "strategic_alignment": "Supports institutional research, innovation and community impact priorities.",
        "consent": "true",
    }
    files = {"files": ("registration.pdf", b"prototype evidence", "application/pdf")}
    return fields, files


def test_public_partner_registration_stores_application_and_document():
    fields, files = _registration_payload()
    response = client.post("/api/auth/register-partner", data=fields, files=files)

    assert response.status_code == 202
    reference = response.json()["reference_number"]
    with SessionLocal() as db:
        application = db.query(PartnerApplication).filter_by(reference_number=reference).one()
        assert application.status == "pending_email_verification"
        assert application.documents[0].original_name == "registration.pdf"


def test_partner_application_verification_and_directorate_approval_create_partner():
    fields, _ = _registration_payload()
    with SessionLocal() as db:
        application, token = service.create_application(db, fields, [])
        application_id = application.id
        reference = application.reference_number

    with SessionLocal() as db:
        verified = service.verify_application_email(db, token)
        assert verified.status == "pending_review"

    headers = _login("linkages@accord360.app", "Linkages@123")
    review = client.patch(
        f"/api/partners/applications/{application_id}/review",
        headers=headers,
        json={"status": "approved", "review_notes": "Verified for prototype demonstration."},
    )
    assert review.status_code == 200
    assert review.json()["reference_number"] == reference
    assert review.json()["status"] == "approved"

    with SessionLocal() as db:
        assert db.query(Partner).filter_by(name=fields["institution_name"]).one().status == "active"


def test_partner_application_requires_email_verification_before_review():
    fields, _ = _registration_payload()
    with SessionLocal() as db:
        application, _ = service.create_application(db, fields, [])

    headers = _login("linkages@accord360.app", "Linkages@123")
    response = client.patch(
        f"/api/partners/applications/{application.id}/review",
        headers=headers,
        json={"status": "approved", "review_notes": "Should be rejected until verified."},
    )
    assert response.status_code == 409


def test_public_partner_registration_rejects_duplicate_active_email():
    fields, _ = _registration_payload()
    first = client.post("/api/auth/register-partner", data=fields)
    second = client.post("/api/auth/register-partner", data=fields)
    assert first.status_code == 202
    assert second.status_code == 409
