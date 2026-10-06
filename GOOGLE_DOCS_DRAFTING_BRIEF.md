# Accord 360 — Google Docs Drafting Integration Brief (Source of Truth)

**Read this entire document before writing any code that touches template
creation, agreement drafting, or the drafting-stage status transitions.**
Where anything below conflicts with the current code, THIS DOCUMENT WINS —
the docx-merge code it describes is being replaced, not preserved.

This brief implements the drafting-flow revision described in
`Accord360_Project_Specification.pdf` (see its "Revision note" and Sections
4–5): Accord 360 stops generating/merging `.docx` files for drafting and
instead hands the researcher a live, editable **Google Doc** copied from a
Linkages-maintained master template. It complements `REBUILD_BRIEF.md`
(roles, the nine statuses, the transition graph) — this document does not
change the role model or the status list, it changes *what happens on top
of* the existing transitions during drafting.

Companion decisions already made (do not re-litigate these):
- Google auth model: a **service account**, not domain-wide delegation.
- Legal's comments live natively in the Google Doc. Accord 360 does **not**
  mirror comment text — it only logs that a "returned for corrections" event
  happened, via the existing `WorkflowEvent.comment` field.
- Internal (Linkages/Legal) Drive access is granted per **individual staff
  email**, not a shared Google Group. This means access changes 1:1 with
  `require_roles("linkages"|"legal")` — see Phase B.

---

## 0. Non-negotiable ground rules

1. Accord 360 does **not** store or diff drafting-stage document content.
   Google Docs' own native revision history is the version history for the
   drafting stage. Accord 360 stores only: status, structured form fields,
   Drive **access grants** (see `AgreementDrivePermission` below), the audit
   trail, and — once, at the very end of drafting — the uploaded final
   signed scan.
2. The **only** file Accord 360 ever stores for an agreement is the final
   signed scan (`AgreementVersion.is_final=True`, uploaded at the
   `awaiting_signatures -> fully_executed` transition). This is already
   correctly implemented today — do not add any other file-storage path for
   the drafting stage. No new `.docx` is ever generated or merged again.
3. Every Drive permission Accord 360 grants **must** be recorded in
   `AgreementDrivePermission` with the `permission_id` Drive returns.
   Revocation must always go through a stored row — never call
   `permissions.list` to "find" what to revoke. This is what makes
   revocation O(1) and locally auditable instead of a live round-trip guess.
4. The external partner is granted access to exactly one document (the
   template copy) via their `Partner.contact_email`, and that access is
   revoked the instant the researcher hits Submit. The partner must never
   be granted access to any other agreement artifact, ever.
5. Do not add speculative config flags, retry frameworks, or abstractions
   beyond what's specified here. If the Drive API call fails, surface a
   plain `HTTPException(502, ...)` — no queue, no background retry job. This
   matches the rest of the codebase's "small internal tool" scale (see
   `AGENTS.md` — APScheduler in-process, no Celery/Redis).
6. Work phase by phase, in the order below. Do not start Phase C before
   Phase A and B pass their acceptance criteria.

---

## 1. External setup (not code — do this first, by hand)

This cannot be automated by a coding agent; it's a one-time manual step in
Google Cloud / Google Workspace admin, needed before Phase A can be tested
against a real Drive:

1. Create (or reuse) a Google Cloud project. Enable the **Drive API** and
   **Docs API** (Docs API isn't called yet in this phase, but enable it now
   since `master_doc_id` values are Google Docs).
2. Create a service account. Generate a JSON key.
3. For each master template Linkages maintains (e.g. "Standard MoU",
   "Standard CRA"), share that Google Doc with the service account's email
   address as **Editor** — otherwise `files.copy` on it will fail.
4. Store the JSON key wherever `backend/.env` secrets live locally; in
   deployment, store it the same way `AWS_SECRET_ACCESS_KEY` etc. are
   already stored (see `backend/app/core/config.py`'s existing pattern).

Until this is done, `GOOGLE_DRIVE_ENABLED=false` (the default) keeps the
integration off and the rest of the app working exactly as it does today.

---

## 2. Config additions (`backend/app/core/config.py`)

Follow the exact pattern already used for `object_storage_enabled` /
`storage_*` — same shape, same `validate()` convention:

```python
google_drive_enabled: bool = env_bool("GOOGLE_DRIVE_ENABLED", False)
google_service_account_json: str | None = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or None
```

`google_service_account_json` is the raw JSON string (or a file path — pick
one convention and use it consistently; raw JSON in the env var matches how
containerized deployments usually inject service-account keys without a
mounted file). Add to `Settings.validate()`:

```python
if self.google_drive_enabled and not self.google_service_account_json:
    raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is required when Drive integration is enabled")
```

Add `google-api-python-client` and `google-auth` to `backend/requirements.txt`.

---

## 3. New integration module: `backend/app/integrations/google_drive.py`

A thin wrapper, mirroring how `app/utils/storage.py` wraps boto3 — no
retries, no abstraction beyond what's called. Every function raises a single
`DriveError(RuntimeError)` on failure, same pattern as `StorageError`.

```python
class DriveError(RuntimeError): ...

def _client():
    if not settings.google_drive_enabled:
        raise DriveError("Google Drive integration is disabled")
    # build googleapiclient.discovery Resource from service-account creds

def copy_template(master_doc_id: str, name: str) -> str:
    """Returns the new doc's file id."""

def grant_permission(doc_id: str, email: str, role: str = "writer", notify: bool = True) -> str:
    """Returns the Drive permission id."""

def revoke_permission(doc_id: str, permission_id: str) -> None: ...

def doc_url(doc_id: str) -> str:
    return f"https://docs.google.com/document/d/{doc_id}/edit"
```

Scopes needed: `https://www.googleapis.com/auth/drive` (copy + manage
permissions on files the service account can access).

---

## 4. Data model changes

### `Template` (`backend/app/modules/templates/models.py`)

Add:
```python
master_doc_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
```
`Template.file` (the uploaded `.docx`) and the docx-placeholder validation
machinery (`validate_docx_placeholders`, `FieldDefinition`-vs-token
checking, `generate_document`) are **retired** — see Phase D. Keep
`FieldDefinition` itself (Section 9 of the spec still wants a structured
form of required data fields); it just no longer needs to match tokens
inside an uploaded file.

### `Agreement` (`backend/app/modules/agreements/models.py`)

Add:
```python
template_copy_doc_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
template_copy_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
renewal_of_id: Mapped[int | None] = mapped_column(ForeignKey("agreements.id"), nullable=True)
```
`renewal_of_id` is self-referencing and is what Section 5/9 of the spec
means by "First Final Signed Document" / "Second Final Signed Document" —
each renewal is a **new** `Agreement` row chained to the previous one, not
a mutation of the same row. Implementing the renewal-side behavior change
(`expired -> renew` creating a new row instead of flipping the existing
one) is explicitly **out of scope for this brief** — track it separately.
Add the column now so that follow-up work doesn't need another migration.

### New table: `AgreementDrivePermission`

```python
class AgreementDrivePermission(Base):
    __tablename__ = "agreement_drive_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("agreements.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "researcher" | "partner" | "linkages" | "legal"
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    permission_id: Mapped[str] = mapped_column(String(120), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    agreement: Mapped["Agreement"] = relationship()
```

`role` here is the reason the grant exists, not the grantee's system role —
e.g. a `linkages` staff member could in principle be granted a `researcher`-
labeled row if the model ever needs that; in practice it will always match
`User.role`. Query pattern for revocation:

```python
db.scalar(
    select(AgreementDrivePermission).where(
        AgreementDrivePermission.agreement_id == agreement.id,
        AgreementDrivePermission.role == "partner",
        AgreementDrivePermission.revoked_at.is_(None),
    )
)
```

Run `alembic revision --autogenerate -m "google docs drafting integration"`,
review the generated migration by hand (per `AGENTS.md`), then `upgrade head`.

---

## 5. Service-layer changes (`backend/app/modules/agreements/service.py`)

This section is the actual behavior spec — implement each bullet exactly as
described so the resulting transition table stays a straightforward,
diffable extension of the existing one.

### 5.1 `create_agreement`

Replace the `docxtpl`/`generate_document`/`add_agreement_version(...,
is_final=False)` block with:

1. Look up the active `Template` for `document_type`; require
   `template.master_doc_id` to be set (400 if not — mirrors today's "No
   active .docx template exists" check).
2. `doc_id = google_drive.copy_template(template.master_doc_id, name=f"{payload.title} — {partner.name}")`
3. `google_drive.grant_permission(doc_id, user.email, role="writer")` →
   store `AgreementDrivePermission(role="researcher", email=user.email, ...)`.
4. `google_drive.grant_permission(doc_id, partner.contact_email, role="writer")`
   → store `AgreementDrivePermission(role="partner", email=partner.contact_email, ...)`.
   If `partner.contact_email` is empty, raise 400 — a partner with no email
   cannot be given a drafting copy.
5. Set `agreement.template_copy_doc_id`, `agreement.template_copy_url =
   google_drive.doc_url(doc_id)`, `status="draft_generated"`.
6. **Do not** call `notify_roles(db, {"linkages"}, ...)` here — remove that
   call from `create_agreement`. Linkages should not be notified until the
   researcher explicitly submits (5.2). This is a real behavior change from
   today's code, which notifies Linkages immediately on creation.
7. No `AgreementVersion` is created at this step. `Agreement.versions`
   stays empty until the final signed scan is uploaded.

### 5.2 New transition: Submit to Linkages

Add to `TRANSITIONS`:
```python
("draft_generated", "submit"): ("pending_legal_review", {"researcher"}),
```
This **replaces** `upload_initial_draft`'s current role as the way an
agreement leaves `draft_generated` — Linkages no longer moves the agreement
forward by uploading a file. Side effects, implemented as a dedicated
branch in `transition_agreement` (same place `mark_fully_executed` and
`resubmit_for_verification` already get special-cased below the generic
`TRANSITIONS` lookup):

1. Look up the agreement's `draft_generated_at`... no — just require the
   researcher confirm the "required fields are filled" checkbox client-side
   (Section 4 of the spec: "trust-based confirmation, not automated
   scanning" — this is a UI-only gate, no new backend field needed since
   `AgreementCreate.field_values` already captures the structured data at
   creation time).
2. Revoke the partner's grant: fetch the un-revoked
   `AgreementDrivePermission(role="partner")` row, call
   `google_drive.revoke_permission(doc_id, permission_id)`, set
   `revoked_at=utc_now()` on the row. If the row is missing (shouldn't
   happen — log via `audit()` and continue; do not block the transition on
   a Drive-side inconsistency).
3. Grant Linkages: for each `User` with `role == "linkages"`, call
   `grant_permission(doc_id, user.email, role="writer")` and store a row
   with `role="linkages"`. This is the "individual staff email" decision —
   every current Linkages user gets an explicit grant at this transition.
4. Grant Legal the same way, `role="legal"`, `role="writer"` (Legal needs
   comment/suggest access at minimum; writer is fine since Legal is not
   expected to edit body content, but restricting to `commenter` is also
   acceptable — pick one and note it in the PR, don't leave it ambiguous
   between environments).
5. `notify_roles(db, {"linkages", "legal"}, ...)` — both now have access and
   both are relevant per Section 6 ("Legal: Same visibility as Linkages").
6. Proceed with the normal `TRANSITIONS`-driven status write, `WorkflowEvent`
   row, and `audit()` call exactly as the existing generic path does.

### 5.3 `upload_initial_draft` → delete its `draft_generated` branch entirely

The `from_status == "draft_generated"` branch (today: Linkages uploads a
`.docx`, agreement moves to `pending_legal_review`) is removed. That edge is
now 5.2, a pure status transition with no file.

### 5.4 `resubmit_for_verification` (`returned_for_corrections -> pending_legal_verification`, Linkages)

Remove the `HTTPException(409, "Upload the corrected agreement draft to
resubmit for verification")` guard in `transition_agreement`. This becomes
a plain status transition through the generic `TRANSITIONS`-driven path —
no file, no `AgreementVersion`, no Drive permission change needed (the same
three parties already have access; corrections happened directly in the
live Doc).

### 5.5 `awaiting_signatures -> fully_executed` (Linkages uploads signed scan)

**Unchanged in behavior.** `upload_initial_draft`'s `from_status ==
"awaiting_signatures"` branch (sets `is_final=True`, computes
`expiry_alert_date`) already matches the spec's "the one point where a real
file enters the system" exactly. Rename the function to
`upload_final_signed_document` for clarity since it's no longer one of
several upload paths, but do not change its logic. Update the router
(`agreements/router.py`) and its route to match the rename.

Optional, not required for Phase B acceptance: downgrade Linkages/Legal's
Drive permissions on the template copy from `writer` to `reader` at this
transition, since the Doc is no longer being edited. If implemented, log
each downgrade the same way as a revoke+regrant pair in
`AgreementDrivePermission` (mark the writer row `revoked_at`, insert a new
reader-role row) so the local audit trail stays accurate. Leave this out of
the first pass if it adds ambiguity — the Doc remaining editable
indefinitely after execution is a cosmetic issue, not a correctness one.

### 5.6 Everything else in `TRANSITIONS`

`request_corrections`, `approve` (both `pending_legal_review` and
`pending_legal_verification`), `start_signing`, `archive` — **no Drive
permission changes**. These are pure status transitions today and stay
that way; the three parties who have access at `draft_generated` submit
time keep the same access through the rest of the drafting/review loop.

---

## 6. Comment model — deprecate, don't delete outright

Per the companion decision already made: Legal's comments live in the
Google Doc natively. `Comment`/`CommentCreate`/`CommentUpdate` and the
`comments_router` endpoints become dead code for the drafting flow. Do not
delete the table/model in this brief's scope (it's out of scope — a
separate cleanup pass per `REBUILD_BRIEF.md`'s own precedent of listing
removals explicitly rather than incidentally). Do, in Phase C, stop the
frontend from calling the comment endpoints and instead surface
`WorkflowEvent.comment` (already populated by `request_corrections`) as the
"what Legal asked for" record.

---

## Phase A — Data model + integration module

**Scope:** Section 2 (config), Section 3 (`google_drive.py`), Section 4
(migration). No behavior change yet — `GOOGLE_DRIVE_ENABLED` stays `false`
in every environment until Phase B lands, so existing tests keep passing
unmodified.

**Acceptance criteria**
- [ ] `backend/app/integrations/google_drive.py` exists with the four
      functions in Section 3, unit-testable by mocking the Drive client.
- [ ] `Settings.validate()` raises when `google_drive_enabled=True` and no
      service-account JSON is configured.
- [ ] Migration adds `templates.master_doc_id`,
      `agreements.template_copy_doc_id`, `agreements.template_copy_url`,
      `agreements.renewal_of_id`, and the `agreement_drive_permissions`
      table. `alembic upgrade head` and `alembic downgrade -1` both succeed
      on a clean sqlite test DB.
- [ ] Existing full test suite (`python -m pytest -q`) still passes
      unmodified — this phase is additive only.

## Phase B — Service-layer rewiring

**Scope:** Section 5 in full, Section 6's backend half (stop nothing yet,
just stop relying on `Comment` for new writes).

**Acceptance criteria**
- [ ] `create_agreement` no longer imports `docxtpl`; it calls
      `google_drive.copy_template` and stores both permission grants via
      `AgreementDrivePermission`.
- [ ] A new agreement's `Agreement.versions` is empty immediately after
      creation (no docx generated).
- [ ] Linkages is **not** notified at creation; is notified at the new
      `submit` transition.
- [ ] `submit` transition revokes the partner's stored permission (verified
      via a test that asserts `revoke_permission` was called with the
      exact `permission_id` stored at creation, not a re-derived one) and
      grants every `linkages`/`legal` user.
- [ ] `resubmit_for_verification` no longer requires a file upload.
- [ ] `awaiting_signatures -> fully_executed` (renamed
      `upload_final_signed_document`) behavior is byte-for-byte unchanged
      from today's `is_final` / `expiry_alert_date` logic — existing tests
      for this path pass after the rename with only the function/route name
      updated.
- [ ] All Drive calls in tests run against a mocked `google_drive` module
      (`GOOGLE_DRIVE_ENABLED=false` in the test env, with the integration
      functions monkeypatched) — no test depends on real Google credentials.

## Phase C — Frontend

**Scope:**
- `Templates.jsx`: replace `.docx` file upload with a "Google Doc URL or
  ID" field when creating/activating a template; store just the ID
  (`master_doc_id`), parsing it out of a pasted `docs.google.com/.../d/<id>/edit`
  URL if that's what's pasted.
- `AgreementDetail.jsx` / `DocumentRepository.jsx`: while status is
  `draft_generated` through `awaiting_signatures`, show an "Open in Google
  Docs" link (`template_copy_url`) instead of a version list; once
  `fully_executed`, show the final signed scan download exactly as today.
- Researcher's create-agreement flow: show the partner's `contact_email`
  that will be granted access (read-only, pulled from the selected
  `Partner`), and the explicit "I confirm all required fields are filled"
  checkbox gating the new Submit action (Section 4 of the spec — this is a
  UI-only confirmation, no new backend field).
- `LegalReviewPanel.jsx`: replace the comment-thread UI with a link to the
  Doc plus the `WorkflowEvent` history filtered to correction events
  (`action == "request_corrections"`, showing `.comment`).
- `frontend/src/lib/backend.js`: update/add endpoint entries per
  `AGENTS.md`'s validation rules (keep `scripts/validate.mjs`'s required/
  unsupported endpoint list in sync, same as any other backend change).

**Acceptance criteria**
- [ ] `npm run check` passes.
- [ ] Manual pass through `run` skill: create an agreement as researcher,
      confirm `template_copy_url` opens a real (or mocked, in dev) Doc link,
      hit Submit, confirm Linkages/Legal now see it and the partner link
      shown to the researcher is annotated/disabled as revoked.

## Phase D — Cleanup (do only after A–C are verified end to end)

- Remove `docxtpl`/`python-docx` from `requirements.txt` if nothing else in
  the codebase uses them (check `templates/service.py`'s
  `validate_docx_placeholders` callers first — if the Templates admin UI
  still wants placeholder validation for some other purpose, keep
  `python-docx` and drop only `docxtpl`).
- Remove `Template.file`, `generate_document`, `validate_docx_placeholders`
  once nothing references them.
- Remove the `Comment` model/router/schemas per Section 6, once Phase C's
  frontend no longer calls them and a decision is made that no audit value
  is lost.

---

## Open items still requiring a human decision

- Legal's Drive role on the template copy: `writer` or `commenter`
  (Section 5.2 step 4) — pick one before Phase B ships, don't leave it
  environment-dependent.
- Whether to downgrade Linkages/Legal to `reader` at `fully_executed`
  (Section 5.5, optional) — cosmetic, can be deferred.
- The `expired -> renew` behavior change to create a new `Agreement` row via
  `renewal_of_id` (Section 4) is **explicitly out of scope for this brief**
  and needs its own brief before implementation, since it changes dashboard
  scoping, M&E's expired-agreements view, and progress-update history
  attribution — non-trivial enough to plan separately.
