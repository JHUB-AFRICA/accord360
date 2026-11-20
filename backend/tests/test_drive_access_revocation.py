"""Removed people must lose Google Doc access for good.

Uses a stateful in-memory Drive so no test touches real Google: list reflects
earlier grants and revokes, exactly like the live permissions API.
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

TEST_DB = Path("test_drive_access_revocation.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["ENVIRONMENT"] = "test"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.integrations.google_drive import DriveError
from app.main import app  # noqa: F401
from app.models import Agreement, Partner, User
from app.modules.agreements import service as agreement_service
from app.modules.agreements.drive_sweep import run_drive_access_sweep
from app.modules.agreements.models import AgreementDrivePermission

SERVICE_ACCOUNT = "accord360@example.iam.gserviceaccount.com"


class FakeDrive:
    def __init__(self):
        self.perms: dict[str, dict[str, dict]] = {}
        self.revoked: list[str] = []
        self.sticky: set[str] = set()  # ids whose delete "succeeds" but does nothing

    def add(self, doc, pid, email=None, role="writer", type_="user", inherited=False, **extra):
        perm = {"id": pid, "type": type_, "role": role, **extra}
        if email:
            perm["emailAddress"] = email
        if inherited:
            perm["permissionDetails"] = [{"inherited": True, "inheritedFrom": "drive"}]
        self.perms.setdefault(doc, {})[pid] = perm

    def emails(self, doc):
        return {p.get("emailAddress") for p in self.perms.get(doc, {}).values()}

    def grant(self, doc, email, role="writer", notify=True, message=None):
        # Drive keys user permissions by account, so a Gmail alias of an
        # existing user returns that user's existing id.
        canonical = email.lower().replace("googlemail.com", "gmail.com")
        for pid, perm in self.perms.get(doc, {}).items():
            if (perm.get("emailAddress") or "").lower().replace("googlemail.com", "gmail.com") == canonical:
                return pid
        pid = f"perm-{uuid4().hex[:8]}"
        self.add(doc, pid, email=email, role=role)
        return pid

    def revoke(self, doc, pid):
        self.revoked.append(pid)
        if pid not in self.sticky:
            self.perms.get(doc, {}).pop(pid, None)

    def update(self, doc, pid, *, role="writer"):
        self.perms[doc][pid]["role"] = role

    def list(self, doc):
        return [dict(p) for p in self.perms.get(doc, {}).values()]


@pytest.fixture
def drive(monkeypatch):
    fake = FakeDrive()
    gd = agreement_service.google_drive
    monkeypatch.setattr(gd, "grant_permission", fake.grant)
    monkeypatch.setattr(gd, "revoke_permission", fake.revoke)
    monkeypatch.setattr(gd, "update_permission", fake.update)
    monkeypatch.setattr(gd, "list_permissions", fake.list)
    monkeypatch.setattr(gd, "service_account_email", lambda: SERVICE_ACCOUNT)
    # Do not depend on the developer's backend/.env: the sweep only runs with Drive on.
    settings = agreement_service.settings
    previous = (settings.google_drive_enabled, settings.google_drive_demo_doc_id)
    object.__setattr__(settings, "google_drive_enabled", True)
    object.__setattr__(settings, "google_drive_demo_doc_id", None)
    try:
        yield fake
    finally:
        object.__setattr__(settings, "google_drive_enabled", previous[0])
        object.__setattr__(settings, "google_drive_demo_doc_id", previous[1])


def _setup(db, status="linkages_review", partner_email=None):
    suffix = uuid4().hex[:8]
    researcher = User(full_name="R", email=f"researcher-{suffix}@example.org",
                      password_hash=hash_password("Password@123"), role="researcher")
    linkages = User(full_name="L", email=f"linkages-{suffix}@example.org",
                    password_hash=hash_password("Password@123"), role="linkages")
    partner = Partner(name=f"P {suffix}", sector="Research", country="Kenya", contact_email=partner_email)
    db.add_all([researcher, linkages, partner])
    db.flush()
    agreement = Agreement(
        title=f"A {suffix}", department="Computing", partner_id=partner.id, researcher_id=researcher.id,
        status=status, start_date=date.today(), end_date=date.today() + timedelta(days=365),
        template_copy_doc_id=f"doc-{suffix}",
    )
    db.add(agreement)
    db.commit()
    return agreement, researcher, linkages


def test_hand_added_share_and_link_sharing_are_stripped(drive):
    with SessionLocal() as db:
        agreement, researcher, linkages = _setup(db)
        doc = agreement.template_copy_doc_id
        drive.add(doc, "extra", email="friend-of-partner@example.org")
        drive.add(doc, "link", type_="anyone", role="reader")
        drive.add(doc, "dom", type_="domain", domain="example.org", role="commenter")
        drive.add(doc, "member", email="builder@example.org", role="writer", inherited=True)
        drive.add(doc, "org", email="admin@example.org", role="organizer", inherited=True)
        drive.add(doc, "sa", email=SERVICE_ACCOUNT, role="fileOrganizer")

        result = agreement_service.reconcile_drive_access(db, agreement)
        db.commit()

        remaining = {p["id"] for p in drive.list(doc)}
        assert {"extra", "link", "dom"}.isdisjoint(remaining)
        assert {"member", "org", "sa"} <= remaining
        assert {researcher.email, linkages.email} <= drive.emails(doc)
        assert "friend-of-partner@example.org" in result["removed"]
        assert "anyone with the link" in result["removed"]


def test_removed_partner_who_reshared_to_themselves_is_removed_again(drive):
    with SessionLocal() as db:
        agreement, _, linkages = _setup(db, status="draft_generated", partner_email="partner@example.org")
        doc = agreement.template_copy_doc_id
        agreement_service.reconcile_drive_access(db, agreement)
        assert "partner@example.org" in drive.emails(doc)

        agreement_service.reconcile_drive_access(db, agreement, target_status="linkages_review")
        agreement.status = "linkages_review"
        db.commit()
        assert "partner@example.org" not in drive.emails(doc)

        # An editor re-shares the Doc to the removed partner from inside Docs.
        drive.add(doc, "sneaky", email="partner@example.org")
        result = run_drive_access_sweep(db)
        assert result["ran"] and result["failed"] == 0
        assert "partner@example.org" not in drive.emails(doc)


def test_alias_spelling_of_a_desired_user_is_not_revoked(drive):
    with SessionLocal() as db:
        agreement, researcher, linkages = _setup(db)
        researcher.email = researcher.email.replace("example.org", "gmail.com")
        db.commit()
        doc = agreement.template_copy_doc_id
        # Drive reports the account under its googlemail spelling.
        drive.add(doc, "r-alias", email=researcher.email.replace("gmail.com", "googlemail.com"))

        agreement_service.reconcile_drive_access(db, agreement)
        db.commit()
        assert "r-alias" in {p["id"] for p in drive.list(doc)}
        assert "r-alias" not in drive.revoked


def test_revoke_that_does_not_stick_fails_loudly(drive, monkeypatch):
    with SessionLocal() as db:
        agreement, _, linkages = _setup(db)
        doc = agreement.template_copy_doc_id
        drive.add(doc, "stuck", email="removed@example.org")
        drive.sticky.add("stuck")
        with pytest.raises(DriveError, match="removed@example.org"):
            agreement_service.reconcile_drive_access(db, agreement)
        db.rollback()


def test_deactivated_researcher_loses_access(drive):
    with SessionLocal() as db:
        agreement, researcher, linkages = _setup(db)
        doc = agreement.template_copy_doc_id
        agreement_service.reconcile_drive_access(db, agreement)
        db.commit()
        assert researcher.email in drive.emails(doc)

        researcher.is_active = False
        db.commit()
        agreement_service.reconcile_agreements_for_people(db, emails={researcher.email}, researcher_id=researcher.id)
        assert researcher.email not in drive.emails(doc)
        assert linkages.email in drive.emails(doc)
        grants = db.scalars(select(AgreementDrivePermission).where(
            AgreementDrivePermission.agreement_id == agreement.id,
            AgreementDrivePermission.email == researcher.email,
        )).all()
        assert grants and all(g.revoked_at is not None for g in grants)


def test_refused_grant_does_not_block_removing_extra_shares(drive, monkeypatch):
    with SessionLocal() as db:
        agreement, _, _ = _setup(db)
        doc = agreement.template_copy_doc_id
        drive.add(doc, "extra", email="intruder@example.org")

        def refuse(*_a, **_k):
            raise DriveError("Google can't share this document")

        monkeypatch.setattr(agreement_service.google_drive, "grant_permission", refuse)
        with pytest.raises(DriveError, match="can't share"):
            agreement_service.reconcile_drive_access(db, agreement, notify=False)
        db.rollback()
        assert "intruder@example.org" not in drive.emails(doc)


def test_dotted_gmail_researcher_is_downgraded_to_read_only(drive):
    """Drive reports flow.res@gmail.com as flowres@gmail.com; the lock to read-only
    must still land on that person instead of leaving them a Writer."""
    with SessionLocal() as db:
        agreement, researcher, _ = _setup(db, status="legal_review")
        researcher.email = f"flow.res+{uuid4().hex[:6]}@gmail.com"
        db.commit()
        doc = agreement.template_copy_doc_id
        canonical = agreement_service._canonical_email(researcher.email)
        drive.add(doc, "dotted", email=canonical, role="writer")

        agreement_service.reconcile_drive_access(db, agreement, target_status="approved_for_signing")
        db.commit()

        assert drive.perms[doc]["dotted"]["role"] == "reader"
        assert len([p for p in drive.list(doc) if p.get("emailAddress") == canonical]) == 1
