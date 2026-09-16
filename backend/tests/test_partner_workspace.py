from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.modules.agreements.models import Agreement, Document
from app.modules.partners import service
from app.modules.partners.models import Partner, PartnerMembership
from app.modules.partners.schemas import PartnerInvitationCreate
from app.modules.users.models import User


client = TestClient(app)


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_partner_invitation_acceptance_creates_scoped_workspace_access():
    suffix = uuid4().hex[:8]
    inviter_email = f"partner-inviter-{suffix}@accord360.app"
    partner_email = f"external-{suffix}@example.org"
    inviter_password = "Linkages@123"
    partner_password = "External@123"
    with SessionLocal() as db:
        inviter = User(full_name="Linkages Inviter", email=inviter_email, password_hash=hash_password(inviter_password), role="linkages")
        partner = Partner(name=f"External Institution {suffix}", sector="Research", country="Kenya", status="active")
        db.add_all([inviter, partner])
        db.flush()
        invitation, token = service.create_partner_invitation(db, partner.id, PartnerInvitationCreate(email=partner_email, full_name="External Contact"), inviter, None)
        partner_id = partner.id
        db.add(Agreement(reference_number=f"PARTNER-{suffix}", title="Partner-visible agreement", agreement_type="MoU", purpose="A sufficiently detailed purpose for partner workspace testing.", department="Research", stage="active", status="active", status_color="green", owner_id=inviter.id, partner_id=partner_id))
        db.commit()

    accepted = client.post(f"/api/auth/partner-invitations/{token}/accept", json={"password": partner_password})
    assert accepted.status_code == 200
    partner_headers = _login(partner_email, partner_password)

    workspace = client.get("/api/partner/me", headers=partner_headers)
    assert workspace.status_code == 200
    assert workspace.json()["partner"]["id"] == partner_id
    assert workspace.json()["user"]["role"] == "partner"

    agreements = client.get("/api/partner/agreements", headers=partner_headers)
    assert agreements.status_code == 200
    assert len(agreements.json()) == 1
    assert agreements.json()[0]["reference_number"] == f"PARTNER-{suffix}"


def test_partner_document_surface_hides_confidential_documents():
    suffix = uuid4().hex[:8]
    email = f"document-partner-{suffix}@example.org"
    password = "External@123"
    with SessionLocal() as db:
        user = User(full_name="Document Partner", email=email, password_hash=hash_password(password), role="partner")
        partner = Partner(name=f"Document Institution {suffix}", sector="Technology", country="Kenya")
        db.add_all([user, partner])
        db.flush()
        db.add(PartnerMembership(partner_id=partner.id, user_id=user.id, membership_role="member", status="active", joined_at=service.utc_now()))
        agreement = Agreement(reference_number=f"DOCUMENT-{suffix}", title="Document visibility agreement", agreement_type="CRA", purpose="A sufficiently detailed purpose for document visibility testing.", department="Computing", stage="active", status="active", status_color="green", owner_id=user.id, partner_id=partner.id)
        db.add(agreement)
        db.flush()
        public_name = f"partner-public-{suffix}.txt"
        private_name = f"partner-private-{suffix}.txt"
        settings.upload_path.mkdir(parents=True, exist_ok=True)
        Path(settings.upload_path / public_name).write_text("public", encoding="utf-8")
        Path(settings.upload_path / private_name).write_text("private", encoding="utf-8")
        db.add_all([
            Document(agreement_id=agreement.id, document_type="supporting", version="1.0", original_name=public_name, stored_name=public_name, mime_type="text/plain", size_bytes=6, uploaded_by_id=user.id, confidentiality="internal"),
            Document(agreement_id=agreement.id, document_type="supporting", version="1.0", original_name=private_name, stored_name=private_name, mime_type="text/plain", size_bytes=7, uploaded_by_id=user.id, confidentiality="confidential"),
        ])
        db.commit()
        agreement_id = agreement.id

    detail = client.get(f"/api/partner/agreements/{agreement_id}", headers=_login(email, password))
    assert detail.status_code == 200
    assert [item["original_name"] for item in detail.json()["documents"]] == [public_name]
