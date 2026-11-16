import os
from pathlib import Path

# Never touch the developer's real database: tests always run on their own
# throwaway SQLite file (set before app.main is imported).
_TEST_DB = Path("test_role_workspaces.db")
if _TEST_DB.exists():
    _TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "true"

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ACCOUNTS = {
    "researcher": ("researcher@accord360.app", "Researcher@123", "JKUAT Researcher"),
    "linkages": ("linkages@accord360.app", "Linkages@123", "Linkages Officer"),
    "legal": ("legal@accord360.app", "Legal@123", "Legal Office Reviewer"),
    "me": ("me@accord360.app", "Measure@123", "M&E Officer"),
}


def auth(role: str) -> dict[str, str]:
    email, password, _ = ACCOUNTS[role]
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    assert login.json()["user"]["role"] == role
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_every_role_gets_its_own_workspace_definition():
    titles = set()
    for role, (_, _, expected_label) in ACCOUNTS.items():
        response = client.get("/api/dashboard/workspace", headers=auth(role))
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["role"] == role
        assert payload["role_label"] == expected_label
        assert payload["capabilities"]
        assert payload["guidance"]
        titles.add(payload["title"])
    assert len(titles) == len(ACCOUNTS)
