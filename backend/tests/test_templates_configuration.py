from __future__ import annotations

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
    name = f"Prototype MoU {uuid4().hex[:8]}"

    created = client.post(
        "/api/templates",
        headers=headers,
        data={"name": name, "agreement_type": "MoU", "version": "1.0", "description": "Approved prototype template"},
        files={"file": ("prototype.docx", b"template bytes", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert created.status_code == 201
    template_id = created.json()["id"]
    assert created.json()["status"] == "active"
    assert created.json()["size_bytes"] == len(b"template bytes")

    listed = client.get("/api/templates?agreement_type=MoU", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == template_id for item in listed.json())

    archived = client.patch(f"/api/templates/{template_id}", headers=headers, json={"status": "archived"})
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"
    assert not any(item["id"] == template_id for item in client.get("/api/templates", headers=headers).json())


def test_configuration_writes_are_admin_only_and_reference_data_is_readable():
    admin_password = "Admin@123"
    admin_email = f"config-admin-{uuid4().hex[:8]}@accord360.app"
    researcher_email = f"config-researcher-{uuid4().hex[:8]}@accord360.app"
    _ensure_user(admin_email, "admin", admin_password)
    _ensure_user(researcher_email, "researcher", "Researcher@123")
    admin = _login(admin_email, admin_password)
    researcher = _login(researcher_email, "Researcher@123")

    forbidden = client.get("/api/configuration", headers=researcher)
    assert forbidden.status_code == 403

    created = client.post(
        "/api/configuration",
        headers=admin,
        json={"key": f"prototype.sla.{uuid4().hex[:6]}", "category": "sla", "value": "10", "description": "Prototype SLA days"},
    )
    assert created.status_code == 201
    key = created.json()["key"]
    updated = client.patch(f"/api/configuration/{key}", headers=admin, json={"value": "15"})
    assert updated.status_code == 200
    assert updated.json()["value"] == "15"

    reference = client.post(
        "/api/reference-data",
        headers=admin,
        json={"category": "prototype", "code": uuid4().hex[:8], "label": "Prototype option", "value": "demo"},
    )
    assert reference.status_code == 201
    readable = client.get("/api/reference-data?category=prototype", headers=researcher)
    assert readable.status_code == 200
    assert readable.json()[0]["label"] == "Prototype option"
