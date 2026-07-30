from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ACCOUNTS = {
    "researcher": ("researcher@accord360.app", "Research@123", "JKUAT Champion"),
    "approver": ("approver@accord360.app", "Approver@123", "Department / Faculty Approver"),
    "linkages": ("linkages@accord360.app", "Linkages@123", "Linkages Officer"),
    "director_linkages": ("director.linkages@accord360.app", "Director@123", "Director, Linkages"),
    "legal": ("legal@accord360.app", "Legal@123", "Legal Office Reviewer"),
    "dvc": ("dvc.rpe@accord360.app", "DvcRpe@123", "DVC RPE"),
    "vc_office": ("vc.office@accord360.app", "VcOffice@123", "VC Office"),
    "me": ("me@accord360.app", "Measure@123", "M&E Officer"),
    "executive": ("executive@accord360.app", "Executive@123", "Executive Viewer"),
    "admin": ("admin@accord360.app", "Admin@123", "System Administrator"),
    "auditor": ("auditor@accord360.app", "Auditor@123", "Auditor / Read-only Reviewer"),
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


def test_business_workflow_is_separated_by_role():
    researcher = auth("researcher")
    partners = client.get("/api/partners", headers=researcher)
    assert partners.status_code == 200
    partner_id = partners.json()[0]["id"]

    created = client.post(
        "/api/agreements",
        headers=researcher,
        json={
            "title": "Role Separation End-to-End Test",
            "agreement_type": "MoU",
            "purpose": "Verify that each institutional role can only perform its assigned workflow action.",
            "department": "Computing",
            "partner_id": partner_id,
        },
    )
    assert created.status_code == 201, created.text
    agreement_id = created.json()["id"]

    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=auth("admin"),
        json={"action": "submit"},
    ).status_code == 403

    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=researcher,
        json={"action": "submit"},
    ).status_code == 200

    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=auth("legal"),
        json={"action": "approve_department"},
    ).status_code == 403
    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=auth("approver"),
        json={"action": "approve_department"},
    ).status_code == 200

    linkages = auth("linkages")
    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=linkages,
        json={"action": "approve_linkages"},
    ).status_code == 200
    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=linkages,
        json={"action": "send_legal"},
    ).status_code == 200

    legal = auth("legal")
    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=linkages,
        json={"action": "approve_legal"},
    ).status_code == 403
    legal_approved = client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=legal,
        json={"action": "approve_legal"},
    )
    assert legal_approved.status_code == 200, legal_approved.text
    assert legal_approved.json()["stage"] == "dvc_approval"

    dvc = auth("dvc")
    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=legal,
        json={"action": "approve_dvc"},
    ).status_code == 403
    dvc_approved = client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=dvc,
        json={"action": "approve_dvc"},
    )
    assert dvc_approved.status_code == 200, dvc_approved.text
    assert dvc_approved.json()["stage"] == "vc_submission"

    submitted_vc = client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=linkages,
        json={"action": "submit_vc"},
    )
    assert submitted_vc.status_code == 200, submitted_vc.text
    assert submitted_vc.json()["status"] == "awaiting_vc_signature"

    vc = auth("vc_office")
    assert client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=auth("executive"),
        json={"action": "record_vc_signature"},
    ).status_code == 403
    vc_signed = client.post(
        f"/api/agreements/{agreement_id}/transition",
        headers=vc,
        json={"action": "record_vc_signature"},
    )
    assert vc_signed.status_code == 200, vc_signed.text
    assert vc_signed.json()["status"] == "awaiting_partner_signature"
