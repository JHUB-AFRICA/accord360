from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

# Never touch the developer's real database: tests always run on their own
# throwaway SQLite file (set before app.main is imported).
_TEST_DB = Path("test_reports.db")
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
        other_researcher = User(full_name="Other Report Researcher", email=f"report-other-{suffix}@accord360.app", password_hash=hash_password(researcher_password), role="researcher")
        linkages = User(full_name="Report Linkages", email=linkages_email, password_hash=hash_password(linkages_password), role="linkages")
        partner = Partner(name=f"Report Partner {suffix}", sector="Technology", country="Kenya")
        db.add_all([researcher, other_researcher, linkages, partner])
        db.flush()
        db.add_all([
            Agreement(
                title="Researcher's report agreement",
                department="Computing",
                status="fully_executed",
                researcher_id=researcher.id,
                partner_id=partner.id,
                start_date=date.today() - timedelta(days=30),
                end_date=date.today() + timedelta(days=365),
            ),
            Agreement(
                title="Other researcher's report agreement",
                department="Engineering",
                status="expired",
                researcher_id=other_researcher.id,
                partner_id=partner.id,
                start_date=date.today() - timedelta(days=730),
                end_date=date.today() - timedelta(days=1),
            ),
        ])
        db.commit()

    researcher_headers = _login(researcher_email, researcher_password)
    linkages_headers = _login(linkages_email, linkages_password)
    researcher_report = client.get("/api/reports/portfolio", headers=researcher_headers)
    assert researcher_report.status_code == 200
    assert researcher_report.json()["totals"]["total_agreements"] == 1
    assert researcher_report.json()["totals"]["fully_executed"] == 1

    full_report = client.get("/api/reports/portfolio", headers=linkages_headers)
    assert full_report.status_code == 200
    assert full_report.json()["totals"]["total_agreements"] >= 2
    assert full_report.json()["totals"]["expired"] >= 1

    exported = client.get("/api/reports/agreements.csv", headers=researcher_headers)
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "Researcher's report agreement" in exported.text
    assert "Other researcher's report agreement" not in exported.text
