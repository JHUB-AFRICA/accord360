from __future__ import annotations

import os
from pathlib import Path

# Never touch the developer's real database: tests always run on their own
# throwaway SQLite file (set before app.main is imported).
_TEST_DB = Path("test_templates_configuration.db")
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
from app.modules.users.models import User


client = TestClient(app)


def _ensure_user(email: str, role: str, password: str) -> None:
    with SessionLocal() as db:
        if not db.query(User).filter_by(email=email).first():
            db.add(User(full_name=f"{role.title()} Test", email=email, password_hash=hash_password(password), role=role))
            db.commit()


def _login(email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_template_library_publishes_lists_and_archives_versions():
    password = "Linkages@123"
    email = f"templates-{uuid4().hex[:8]}@accord360.app"
    _ensure_user(email, "linkages", password)
    headers = _login(email, password)
    master_doc_id = f"prototype-mou-{uuid4().hex[:8]}"

    created = client.post(
        "/api/templates",
        headers=headers,
        data={"document_type": "MoU", "master_doc_id": master_doc_id},
        files={"file": ("prototype.docx", b"template bytes", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert created.status_code == 201
    template_id = created.json()["id"]
    assert created.json()["is_active"] is False
    assert created.json()["master_doc_id"] == master_doc_id
    assert created.json()["file"].endswith(".docx")

    listed = client.get("/api/templates?document_type=MoU", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == template_id for item in listed.json())

    activated = client.post(f"/api/templates/{template_id}/activate", headers=headers)
    assert activated.status_code == 200
    assert activated.json()["is_active"] is True

    deactivated = client.post(f"/api/templates/{template_id}/deactivate", headers=headers)
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False


def test_configuration_writes_are_linkages_only_and_reference_data_is_readable():
    linkages_password = "Linkages@123"
    linkages_email = f"config-linkages-{uuid4().hex[:8]}@accord360.app"
    researcher_email = f"config-researcher-{uuid4().hex[:8]}@accord360.app"
    _ensure_user(linkages_email, "linkages", linkages_password)
    _ensure_user(researcher_email, "researcher", "Researcher@123")
    linkages = _login(linkages_email, linkages_password)
    researcher = _login(researcher_email, "Researcher@123")

    forbidden = client.get("/api/configuration", headers=researcher)
    assert forbidden.status_code == 403

    created = client.post(
        "/api/configuration",
        headers=linkages,
        json={"key": f"prototype.sla.{uuid4().hex[:6]}", "category": "sla", "value": "10", "description": "Prototype SLA days"},
    )
    assert created.status_code == 201
    key = created.json()["key"]
    updated = client.patch(f"/api/configuration/{key}", headers=linkages, json={"value": "15"})
    assert updated.status_code == 200
    assert updated.json()["value"] == "15"

    reference = client.post(
        "/api/reference-data",
        headers=linkages,
        json={"category": "prototype", "code": uuid4().hex[:8], "label": "Prototype option", "value": "demo"},
    )
    assert reference.status_code == 201
    readable = client.get("/api/reference-data?category=prototype", headers=researcher)
    assert readable.status_code == 200
    assert readable.json()[0]["label"] == "Prototype option"
