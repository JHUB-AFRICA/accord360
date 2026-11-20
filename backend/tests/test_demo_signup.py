import os
from pathlib import Path
from uuid import uuid4

TEST_DB = Path(f"test_demo_signup_{os.getpid()}.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "true"

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def _enable(monkeypatch, value=True):
    monkeypatch.setattr(type(settings), "allow_demo_signup", value, raising=False)
    object.__setattr__(settings, "allow_demo_signup", value)


def _email():
    return f"{uuid4().hex[:8]}.person@example.com"


def test_signup_disabled_by_default():
    assert client.get("/api/auth/config").json() == {"demo_signup_enabled": False}
    response = client.post("/api/auth/signup", json={"email": _email(), "password": "demo-pass-1", "role": "legal"})
    assert response.status_code == 404


def test_signup_each_office_and_login(monkeypatch):
    _enable(monkeypatch)
    try:
        assert client.get("/api/auth/config").json() == {"demo_signup_enabled": True}
        for role in ("legal", "linkages", "me"):
            email = _email()
            response = client.post("/api/auth/signup", json={"email": email, "password": "demo-pass-1", "role": role, "department": "ignored"})
            assert response.status_code == 201, response.text
            body = response.json()
            assert body["user"]["role"] == role and body["user"]["department"] is None
            assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}).status_code == 200
            assert client.post("/api/auth/login", json={"email": email, "password": "demo-pass-1"}).status_code == 200
    finally:
        object.__setattr__(settings, "allow_demo_signup", False)


def test_researcher_needs_department_and_duplicates_rejected(monkeypatch):
    _enable(monkeypatch)
    try:
        email = _email()
        payload = {"email": email, "password": "demo-pass-1", "role": "researcher"}
        assert client.post("/api/auth/signup", json=payload).status_code == 422
        ok = client.post("/api/auth/signup", json={**payload, "department": "Computing"})
        assert ok.status_code == 201 and ok.json()["user"]["department"] == "Computing"
        assert ok.json()["user"]["full_name"].endswith(" Person")
        assert client.post("/api/auth/signup", json={**payload, "department": "Computing"}).status_code == 409
        assert client.post("/api/auth/signup", json={**payload, "email": "legal@accord360.app", "department": "x", "role": "legal"}).status_code == 409
    finally:
        object.__setattr__(settings, "allow_demo_signup", False)
