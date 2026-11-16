"""Focused contract tests for the post-Legal physical-signing workflow."""

from __future__ import annotations

import os
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

TEST_DB = Path(f"test_signing_flow_{os.getpid()}.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = "test_signing_uploads"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import Settings, settings
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models import Agreement, AgreementVersion, Notification, Partner, User
from app.modules.agreements.models import AgreementDrivePermission
from app.modules.agreements import router as agreement_router
from app.modules.agreements import service
from app.modules.workflows.schemas import TransitionRequest
from app.utils import storage


client = TestClient(app)
PDF = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _docx() -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
    return output.getvalue()


def _user(db, role: str, suffix: str) -> User:
    user = User(
        full_name=f"{role.title()} {suffix}",
        email=f"{role}-{suffix}@example.com",
        password_hash="not-used-by-signing-tests",
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def _agreement(
    db,
    researcher: User,
    status: str,
    *,
    title: str | None = None,
    with_doc: bool = True,
) -> Agreement:
    suffix = uuid4().hex[:8]
    partner = Partner(name=f"Signing Partner {suffix}", sector="Research", country="Kenya")
    db.add(partner)
    db.flush()
    agreement = Agreement(
        title=title or f"Research Collaboration {suffix}",
        partner_id=partner.id,
        department="Research",
        researcher_id=researcher.id,
        status=status,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=730),
    )
    if with_doc:
        agreement.template_copy_doc_id = f"doc-{suffix}"
        agreement.template_copy_url = f"https://docs.google.com/document/d/doc-{suffix}/edit"
        agreement.approved_doc_modified_at = "2026-11-15T10:00:00.000Z"
    db.add(agreement)
    db.flush()
    return agreement


def _headers(user: User) -> dict[str, str]:
    token = create_access_token(user.email, user.role, user.id)
    return {"Authorization": f"Bearer {token}"}


def _http_error(call, status_code: int, contains: str | None = None) -> HTTPException:
    with pytest.raises(HTTPException) as caught:
        call()
    assert caught.value.status_code == status_code
    if contains:
        assert contains.lower() in str(caught.value.detail).lower()
    return caught.value


def _mock_reconcile(monkeypatch):
    monkeypatch.setattr(service, "reconcile_drive_access", lambda db, agreement, target_status=None: {
        "status": target_status or agreement.status,
        "synchronized": True,
    })


def _upload(db, user, agreement_id: int, content: bytes, filename: str, mime: str | None):
    return service.upload_final_signed_document(
        db,
        user,
        agreement_id,
        content,
        filename,
        None,
        content_type=mime,
    )


def test_start_signing_checks_approval_snapshot_and_preserves_status_on_failure(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        unchanged = _agreement(db, researcher, "approved_for_signing")
        changed = _agreement(db, researcher, "approved_for_signing")
        db.commit()

        _mock_reconcile(monkeypatch)
        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda doc_id: (
            "2026-11-15T10:00:00.000Z" if doc_id == unchanged.template_copy_doc_id
            else "2026-11-15T10:00:01.000Z"
        ))

        result = service.transition_agreement(
            db, linkages, unchanged.id, TransitionRequest(action="start_signing"), None,
        )
        assert result.status == "awaiting_signatures"
        assert result.doc_modified_after_approval is False

        _http_error(
            lambda: service.transition_agreement(
                db, linkages, changed.id, TransitionRequest(action="start_signing"), None,
            ),
            409,
            "changed after Legal approval",
        )
        db.refresh(changed)
        assert changed.status == "approved_for_signing"


def test_signing_stage_reconciliation_is_idempotent_read_only_and_preserves_inherited(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, "awaiting_signatures")
        db.commit()

        all_linkages = db.scalars(select(User).where(User.role == "linkages", User.is_active.is_(True))).all()
        permissions = [
            {"id": "researcher-perm", "type": "user", "emailAddress": researcher.email, "role": "writer"},
            *[
                {
                    "id": "linkages-perm" if actor.id == linkages.id else f"linkages-{actor.id}",
                    "type": "user",
                    "emailAddress": actor.email,
                    "role": "writer",
                }
                for actor in all_linkages
            ],
            {
                "id": "inherited-perm",
                "type": "user",
                "emailAddress": "inherited@example.org",
                "role": "writer",
                "permissionDetails": [{"inherited": True, "inheritedFrom": "shared-drive"}],
            },
        ]
        updates: list[tuple[str, str]] = []
        revocations: list[str] = []

        monkeypatch.setattr(service.google_drive, "list_permissions", lambda _doc: permissions)

        def update(_doc, permission_id, role):
            updates.append((permission_id, role))
            next(item for item in permissions if item["id"] == permission_id)["role"] = role

        monkeypatch.setattr(service.google_drive, "update_permission", update)
        monkeypatch.setattr(service.google_drive, "revoke_permission", lambda _doc, pid: revocations.append(pid))
        monkeypatch.setattr(service.google_drive, "grant_permission", lambda *_a, **_k: pytest.fail("no grant expected"))
        # The test database may contain seeded staff from another test module;
        # isolate the reconciliation policy to the two participants above.
        monkeypatch.setattr(service, "_staff_emails", lambda _db, role: [linkages.email] if role == "linkages" else [])

        first = service.reconcile_drive_access(db, agreement)
        second = service.reconcile_drive_access(db, agreement)

        assert ("linkages-perm", "reader") in updates
        assert ("researcher-perm", "reader") in updates
        assert all(role == "reader" for _, role in updates)
        assert revocations == []
        assert first["inherited_permissions_present"] is True
        assert first["changed"] is True
        assert second["changed"] is False
        assert next(item for item in permissions if item["id"] == "researcher-perm")["role"] == "reader"
        assert next(item for item in permissions if item["id"] == "linkages-perm")["role"] == "reader"


@pytest.mark.parametrize("status", ["approved_for_signing", "awaiting_signatures"])
@pytest.mark.parametrize(
    ("output_format", "mime", "suffix", "payload"),
    [("pdf", PDF_MIME, ".pdf", PDF), ("docx", DOCX_MIME, ".docx", _docx())],
)
def test_linkages_exports_both_formats_in_both_allowed_statuses(
    monkeypatch, status, output_format, mime, suffix, payload,
):
    with SessionLocal() as db:
        token = uuid4().hex[:8]
        researcher = _user(db, "researcher", token)
        linkages = _user(db, "linkages", token)
        agreement = _agreement(db, researcher, status, title="Research Collaboration / Kenya")
        db.commit()
        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: agreement.approved_doc_modified_at)
        monkeypatch.setattr(service.google_drive, "export_file", lambda _doc, requested: payload if requested == mime else pytest.fail(requested))

        content, content_type, filename = service.export_signing_copy(db, linkages, agreement.id, output_format)

        assert content == payload
        assert content_type == mime
        assert filename == f"Research-Collaboration-Kenya-signing-copy{suffix}"


def test_export_authorization_status_format_and_drive_failures(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        legal = _user(db, "legal", suffix)
        me = _user(db, "me", suffix)
        approved = _agreement(db, researcher, "approved_for_signing")
        wrong_status = _agreement(db, researcher, "legal_review")
        no_doc = _agreement(db, researcher, "approved_for_signing", with_doc=False)
        db.commit()
        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: approved.approved_doc_modified_at)

        for actor in (researcher, legal, me):
            _http_error(lambda actor=actor: service.export_signing_copy(db, actor, approved.id, "pdf"), 403)
        _http_error(lambda: service.export_signing_copy(db, linkages, wrong_status.id, "pdf"), 409)
        _http_error(lambda: service.export_signing_copy(db, linkages, no_doc.id, "pdf"), 409)
        _http_error(lambda: service.export_signing_copy(db, linkages, approved.id, "xlsx"), 400)

        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: "2026-11-15T10:00:01.000Z")
        _http_error(lambda: service.export_signing_copy(db, linkages, approved.id, "pdf"), 409, "changed")

        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: approved.approved_doc_modified_at)
        monkeypatch.setattr(
            service.google_drive,
            "export_file",
            lambda *_a: (_ for _ in ()).throw(service.DriveError("Drive export unavailable")),
        )
        _http_error(lambda: service.export_signing_copy(db, linkages, approved.id, "pdf"), 502, "Drive export unavailable")


@pytest.mark.parametrize(
    ("filename", "content", "mime"),
    [("Final Signed.pdf", PDF, PDF_MIME), ("Final Signed.docx", _docx(), DOCX_MIME)],
)
def test_valid_final_upload_persists_metadata_finalizes_once_and_notifies(filename, content, mime):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        legal = _user(db, "legal", suffix)
        me = _user(db, "me", suffix)
        agreement = _agreement(db, researcher, "awaiting_signatures")
        agreement_id = agreement.id
        end_date = agreement.end_date
        db.commit()

        result = _upload(db, linkages, agreement_id, content, filename, mime)

        assert result.status == "fully_executed"
        finals = db.scalars(select(AgreementVersion).where(
            AgreementVersion.agreement_id == agreement_id,
            AgreementVersion.is_final.is_(True),
        )).all()
        assert len(finals) == 1
        assert finals[0].original_filename == filename
        assert finals[0].content_type == mime
        assert finals[0].file_size == len(content)
        assert (settings.upload_path / finals[0].file).read_bytes() == content
        persisted = db.get(Agreement, agreement_id)
        assert persisted.expiry_alert_date < end_date
        recipients = set(db.scalars(select(Notification.user_id).where(Notification.agreement_id == agreement_id)).all())
        assert {researcher.id, legal.id, me.id}.issubset(recipients)

        _http_error(
            lambda: _upload(db, linkages, agreement_id, PDF, "again.pdf", PDF_MIME),
            409,
        )
        assert db.query(AgreementVersion).filter(AgreementVersion.agreement_id == agreement_id).count() == 1


@pytest.mark.parametrize(
    ("filename", "content", "mime", "status"),
    [
        ("empty.pdf", b"", PDF_MIME, 400),
        ("signed.doc", PDF, "application/msword", 400),
        ("spoofed.docx", PDF, DOCX_MIME, 400),
        ("malformed.docx", b"PK\x03\x04not-a-real-zip", DOCX_MIME, 400),
        ("too-large.pdf", b"%PDF-" + b"x" * (service.MAX_SIGNED_FILE_SIZE + 1), PDF_MIME, 413),
    ],
)
def test_invalid_uploads_are_rejected_without_finalizing(filename, content, mime, status):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, "awaiting_signatures")
        agreement_id = agreement.id
        db.commit()

        _http_error(
            lambda: _upload(db, linkages, agreement_id, content, filename, mime),
            status,
        )
        db.refresh(agreement)
        assert agreement.status == "awaiting_signatures"
        assert db.query(AgreementVersion).filter(AgreementVersion.agreement_id == agreement_id).count() == 0


def test_upload_requires_linkages_and_awaiting_signatures():
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, "awaiting_signatures")
        approved = _agreement(db, researcher, "approved_for_signing")
        db.commit()

        _http_error(
            lambda: _upload(db, researcher, agreement.id, PDF, "signed.pdf", PDF_MIME),
            403,
        )
        _http_error(
            lambda: _upload(db, linkages, approved.id, PDF, "signed.pdf", PDF_MIME),
            409,
        )


def test_storage_failure_does_not_falsely_complete_agreement(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, "awaiting_signatures")
        agreement_id = agreement.id
        db.commit()

        monkeypatch.setattr(Settings, "storage_enabled", property(lambda _self: True))
        monkeypatch.setattr(storage, "upload_file", lambda *_a, **_k: (_ for _ in ()).throw(storage.StorageError("down")))
        _http_error(
            lambda: _upload(db, linkages, agreement_id, PDF, "signed.pdf", PDF_MIME),
            502,
        )
        db.refresh(agreement)
        assert agreement.status == "awaiting_signatures"
        assert db.query(AgreementVersion).filter(AgreementVersion.agreement_id == agreement_id).count() == 0


def test_database_failure_cleans_up_new_local_file(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, "awaiting_signatures")
        agreement_id = agreement.id
        db.commit()

        before = set((settings.upload_path / "agreement-versions").glob("*"))
        monkeypatch.setattr(db, "commit", lambda: (_ for _ in ()).throw(RuntimeError("database unavailable")))
        _http_error(
            lambda: _upload(db, linkages, agreement_id, PDF, "signed.pdf", PDF_MIME),
            500,
        )
        after = set((settings.upload_path / "agreement-versions").glob("*"))
        assert after == before
        assert db.get(Agreement, agreement_id).status == "awaiting_signatures"


def test_official_download_local_role_matrix_friendly_name_and_missing_file():
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        owner = _user(db, "researcher", f"owner-{suffix}")
        other = _user(db, "researcher", f"other-{suffix}")
        linkages = _user(db, "linkages", suffix)
        legal = _user(db, "legal", suffix)
        me = _user(db, "me", suffix)
        agreement = _agreement(db, owner, "fully_executed")
        stored_name = f"agreement-versions/{uuid4().hex}.pdf"
        path = settings.upload_path / stored_name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(PDF)
        version = AgreementVersion(
            agreement_id=agreement.id,
            file=stored_name,
            original_filename="Official Signed Agreement.pdf",
            content_type=PDF_MIME,
            file_size=len(PDF),
            uploaded_by_id=linkages.id,
            status_at_time="awaiting_signatures",
            is_final=True,
        )
        db.add(version)
        db.commit()
        agreement_id, version_id = agreement.id, version.id
        role_headers = {actor.role + str(actor.id): _headers(actor) for actor in (linkages, legal, me, owner, other)}

    url = f"/api/agreements/{agreement_id}/versions/{version_id}/download"
    for actor in (linkages, legal, me, owner):
        response = client.get(url, headers=role_headers[actor.role + str(actor.id)])
        assert response.status_code == 200, response.text
        assert response.content == PDF
        assert response.headers["content-type"].startswith(PDF_MIME)
        assert "Official%20Signed%20Agreement.pdf" in response.headers["content-disposition"]

    concealed = client.get(url, headers=role_headers[other.role + str(other.id)])
    assert concealed.status_code == 404

    path.unlink()
    missing = client.get(url, headers=role_headers[linkages.role + str(linkages.id)])
    assert missing.status_code == 404


def test_official_download_uses_object_storage_branch(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        owner = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, owner, "fully_executed")
        version = AgreementVersion(
            agreement_id=agreement.id,
            file="agreement-versions/object.pdf",
            original_filename="object-backed.pdf",
            content_type=PDF_MIME,
            file_size=len(PDF),
            uploaded_by_id=linkages.id,
            status_at_time="awaiting_signatures",
            is_final=True,
        )
        db.add(version)
        db.commit()
        headers = _headers(linkages)
        url = f"/api/agreements/{agreement.id}/versions/{version.id}/download"

    monkeypatch.setattr(Settings, "storage_enabled", property(lambda _self: True))
    monkeypatch.setattr(storage, "download_file", lambda key: iter([PDF[:10], PDF[10:]]))
    response = client.get(url, headers=headers)
    assert response.status_code == 200
    assert response.content == PDF

    monkeypatch.setattr(storage, "download_file", lambda key: (_ for _ in ()).throw(storage.StorageError("missing")))
    response = client.get(url, headers=headers)
    assert response.status_code == 404


def test_legal_approval_makes_everyone_read_only(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, "approved_for_signing")
        db.commit()
        monkeypatch.setattr(service, "_staff_emails", lambda _db, role: [linkages.email] if role == "linkages" else [])

        rows = service.desired_drive_access(db, agreement)

        assert {row["role"] for row in rows} == {"researcher", "linkages"}
        assert all(row["drive_role"] == "reader" for row in rows)


@pytest.mark.parametrize("status", ["approved_for_signing", "awaiting_signatures"])
def test_doc_link_is_withheld_until_the_signed_version_is_uploaded(monkeypatch, status):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        locked = _agreement(db, researcher, status)
        executed = _agreement(db, researcher, "fully_executed")
        db.commit()
        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: locked.approved_doc_modified_at)

        for actor in (researcher, linkages):
            assert service.get_agreement_detail(db, actor, locked.id).template_copy_url is None
        assert service.get_agreement_detail(db, researcher, executed.id).template_copy_url == executed.template_copy_url


def test_only_linkages_page_loads_query_drive_for_changes(monkeypatch):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        agreement = _agreement(db, researcher, "approved_for_signing")
        db.commit()
        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: pytest.fail("no Drive call expected"))

        detail = service.get_agreement_detail(db, researcher, agreement.id)

        assert detail.doc_modified_after_approval is None


@pytest.mark.parametrize("status", ["approved_for_signing", "awaiting_signatures"])
def test_send_back_to_legal_is_only_offered_and_allowed_when_doc_changed(monkeypatch, status):
    with SessionLocal() as db:
        suffix = uuid4().hex[:8]
        researcher = _user(db, "researcher", suffix)
        linkages = _user(db, "linkages", suffix)
        agreement = _agreement(db, researcher, status)
        agreement.approved_by_name = "Legal Reviewer"
        db.commit()
        _mock_reconcile(monkeypatch)

        unchanged_time = agreement.approved_doc_modified_at
        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: unchanged_time)
        detail = service.get_agreement_detail(db, linkages, agreement.id)
        assert detail.doc_modified_after_approval is False
        assert "send_to_legal" not in detail.available_actions
        _http_error(
            lambda: service.transition_agreement(db, linkages, agreement.id, TransitionRequest(action="send_to_legal"), None),
            409,
            "has not changed",
        )
        db.refresh(agreement)
        assert agreement.status == status

        monkeypatch.setattr(service.google_drive, "get_modified_time", lambda _doc: "2026-11-15T10:00:01.000Z")
        detail = service.get_agreement_detail(db, linkages, agreement.id)
        assert detail.doc_modified_after_approval is True
        assert "send_to_legal" in detail.available_actions

        result = service.transition_agreement(
            db, linkages, agreement.id, TransitionRequest(action="send_to_legal", comment="Doc edited after approval"), None,
        )
        assert result.status == "legal_review"
        db.refresh(agreement)
        assert agreement.approved_at is None
        assert agreement.approved_by_name is None
        assert agreement.approved_doc_modified_at is None


class _FakeRequest:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class _FakeDrive:
    """Minimal stand-in for the Drive v3 client's files()/revisions() calls."""

    def __init__(self, revision_pages, file_modified="2026-11-15T12:00:00.000Z"):
        self.revision_pages = revision_pages
        self.file_modified = file_modified

    def revisions(self):
        drive = self

        class Revisions:
            def list(self, fileId, pageToken=None, **_kwargs):
                index = int(pageToken or 0)
                page = drive.revision_pages[index]
                if isinstance(page, Exception):
                    return _FakeRequest(page)
                payload = {"revisions": page}
                if index + 1 < len(drive.revision_pages):
                    payload["nextPageToken"] = str(index + 1)
                return _FakeRequest(payload)

        return Revisions()

    def files(self):
        drive = self

        class Files:
            def get(self, **_kwargs):
                return _FakeRequest({"modifiedTime": drive.file_modified})

        return Files()


def test_modified_time_tracks_content_revisions_not_sharing_changes(monkeypatch):
    from app.integrations import google_drive

    # The file's modifiedTime (12:00) was bumped by a permission change; the
    # newest content revision (10:00, on the second page) is what counts.
    fake = _FakeDrive([
        [{"modifiedTime": "2026-11-15T08:00:00.000Z"}],
        [{"modifiedTime": "2026-11-15T10:00:00.000Z"}, {"modifiedTime": "2026-11-15T09:00:00.000Z"}],
    ])
    monkeypatch.setattr(google_drive, "_client", lambda: fake)
    assert google_drive.get_modified_time("doc") == "2026-11-15T10:00:00.000Z"

    # No revisions visible: fall back to the file's modifiedTime.
    monkeypatch.setattr(google_drive, "_client", lambda: _FakeDrive([[]]))
    assert google_drive.get_modified_time("doc") == "2026-11-15T12:00:00.000Z"

    # Drive failure: unknown, never "unchanged".
    monkeypatch.setattr(google_drive, "_client", lambda: _FakeDrive([RuntimeError("boom")]))
    assert google_drive.get_modified_time("doc") is None


def test_drive_client_is_built_once_per_thread(monkeypatch):
    import threading
    from app.integrations import google_drive

    built: list[int] = []
    monkeypatch.setattr(google_drive, "_thread_local", threading.local())
    monkeypatch.setattr(google_drive, "_build_client", lambda: built.append(threading.get_ident()) or object())

    main_first, main_second = google_drive._client(), google_drive._client()
    other: list[object] = []
    worker = threading.Thread(target=lambda: other.append(google_drive._client()))
    worker.start()
    worker.join()

    assert main_first is main_second
    assert other[0] is not main_first
    assert len(built) == 2
