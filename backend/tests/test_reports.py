from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.modules.agreements.models import Agreement
from app.modules.partners.models import Partner
from app.modules.users.models import User


client = TestClient(app)


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_portfolio_report_and_generated_formats_use_authorized_scope():
    suffix = uuid4().hex[:8]
    researcher_email = f"report-researcher-{suffix}@accord360.app"
    linkages_email = f"report-linkages-{suffix}@accord360.app"
    researcher_password = "Researcher@123"
    linkages_password = "Linkages@123"
    with SessionLocal() as db:
        researcher = User(full_name="Report Researcher", email=researcher_email, password_hash=hash_password(researcher_password), role="researcher")
        linkages = User(full_name="Report Linkages", email=linkages_email, password_hash=hash_password(linkages_password), role="linkages")
        partner = Partner(name=f"Report Partner {suffix}", sector="Technology", country="Kenya")
        db.add_all([researcher, linkages, partner])
        db.flush()
        db.add_all([
            Agreement(reference_number=f"REPORT-{suffix}-1", title="Researcher's report agreement", agreement_type="CRA", purpose="A sufficiently detailed research collaboration purpose.", department="Computing", stage="active", status="active", status_color="green", owner_id=researcher.id, partner_id=partner.id),
            Agreement(reference_number=f"REPORT-{suffix}-2", title="Linkages report agreement", agreement_type="MoU", purpose="A sufficiently detailed institutional collaboration purpose.", department="Engineering", stage="legal_review", status="in_legal_review", status_color="orange", owner_id=linkages.id, partner_id=partner.id),
        ])
        db.commit()

    researcher_headers = _login(researcher_email, researcher_password)
    linkages_headers = _login(linkages_email, linkages_password)
    researcher_report = client.get("/api/reports/portfolio", headers=researcher_headers)
    assert researcher_report.status_code == 200
    assert researcher_report.json()["totals"]["total_partnerships"] == 1

    full_report = client.get("/api/reports/portfolio", headers=linkages_headers)
    assert full_report.status_code == 200
    assert full_report.json()["totals"]["total_partnerships"] >= 2
    assert full_report.json()["totals"]["at_risk"] >= 1

    pdf = client.get("/api/reports/export.pdf", headers=researcher_headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF-")

    excel = client.get("/api/reports/export.xlsx", headers=researcher_headers)
    assert excel.status_code == 200
    assert "spreadsheetml" in excel.headers["content-type"]
    assert excel.content.startswith(b"PK")

    summary = client.post("/api/reports/ai-summary", headers=researcher_headers, json={})
    assert summary.status_code == 200
    assert summary.json()["requires_human_review"] is True
    assert "authorized portfolio" in summary.json()["summary"]
