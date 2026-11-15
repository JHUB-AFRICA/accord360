# Accord 360 Signing Flow — Swarm Implementation Brief

## 1. Mission

Implement a small, reliable physical-signing workflow after Legal approval:

1. Legal approves the live Google Doc.
2. Linkages starts signing only if the document has not changed since approval.
3. Linkages downloads the approved agreement as either DOCX or PDF.
4. Linkages coordinates physical signing outside Accord 360.
5. Linkages uploads the signed DOCX or PDF.
6. The upload becomes the single immutable official agreement.
7. Linkages, Legal, M&E, and the agreement's owning Researcher can download it.

This is a physical-signing and document-custody feature. It is not an e-signature platform.

## 2. Non-negotiable product rules

- Keep the existing statuses. Do not add another workflow state.
- `approved_for_signing -> awaiting_signatures` remains the `start_signing` transition.
- Only Linkages may start signing, export the signing copy, or upload the final signed file.
- Signing-copy export is available only in `approved_for_signing` and `awaiting_signatures`.
- Final upload is available only in `awaiting_signatures`.
- Accepted final formats are `.pdf` and `.docx` only. Do not silently accept legacy `.doc`.
- Maximum final upload size is 25 MiB.
- A successful final upload changes the agreement to `fully_executed`.
- Exactly one final version is allowed. Do not create a replacement or deletion workflow.
- The owning Researcher may read only their own agreement. Linkages, Legal, and M&E retain the existing full internal read scope.
- Backend authorization is authoritative. Hidden frontend buttons are not security controls.
- In-app notifications remain the notification mechanism. Do not add email work.
- Preserve existing reconciliation and notification work already present in the dirty worktree.

## 3. Exact API contract

Agents must use this contract unless the coordinator explicitly changes it for a demonstrated technical reason.

### 3.1 Export the approved signing copy

`GET /api/agreements/{agreement_id}/signing-copy?format=pdf`

or:

`GET /api/agreements/{agreement_id}/signing-copy?format=docx`

Rules:

- Authenticated Linkages user only.
- Agreement must be `approved_for_signing` or `awaiting_signatures`.
- Agreement must have `template_copy_doc_id` and recorded Legal approval metadata.
- Before exporting, compare the current Drive `modifiedTime` with `approved_doc_modified_at`.
- If the document changed after Legal approval, return HTTP `409` with a stable, human-readable message instructing Linkages to send it through Legal review again.
- Use Google Drive `files.export` through `backend/app/integrations/google_drive.py`.
- PDF MIME: `application/pdf`.
- DOCX MIME: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Return bytes with the correct content type and a safe filename derived from the agreement title, for example `research-collaboration-agreement-signing-copy.pdf`.
- Convert Drive failures into the project's normal `502` integration error behavior without leaking credentials or raw service-account data.
- Be aware that Google Drive's normal Workspace export response is limited to 10 MB. Surface a useful failure if Google rejects an oversized export.

### 3.2 Start signing

The existing transition endpoint and `start_signing` action remain unchanged externally.

Before changing status:

- Fetch the current Drive modification time.
- If it is newer than the Legal approval snapshot, return `409` and leave both status and permissions unchanged.
- Reconciliation must then make managed Researcher and Linkages access read-only for `awaiting_signatures`.
- The service account must retain the access required to export.
- Reconciliation must remain idempotent and safe to retry.
- Never remove inherited or unrelated Drive permissions.

The `doc_modified_after_approval` result must remain meaningful in both `approved_for_signing` and `awaiting_signatures`, not disappear after `start_signing`.

### 3.3 Upload the final signed agreement

Keep:

`POST /api/agreements/{agreement_id}/versions`

Multipart field: `file`.

Rules:

- Authenticated Linkages user only.
- Agreement must be `awaiting_signatures`.
- Read the upload with a bounded/chunked limit so an oversized request is rejected without loading an arbitrary-sized file into memory.
- Limit: 25 MiB (`25 * 1024 * 1024` bytes).
- Validate extension and actual structure:
  - PDF must have `.pdf` and begin with a valid PDF signature such as `%PDF-`.
  - DOCX must have `.docx`, be a valid ZIP container, and contain at least `[Content_Types].xml` and `word/document.xml`.
- Treat the browser-provided MIME type as supporting information, not proof.
- Reject empty, unsupported, extension-spoofed, malformed, and oversized files with a clear `400` or `413` response.
- Store the file before marking the agreement complete, but clean up the stored object/file if the database transaction fails.
- Do not set `fully_executed` unless the final file is retrievable.
- Preserve the one-final-version invariant and existing expiry-date and notification behavior.

### 3.4 Download the official signed agreement

Keep:

`GET /api/agreements/{agreement_id}/versions/{version_id}/download`

Rules:

- Continue applying `ensure_can_view_agreement`.
- Allowed readers therefore remain Linkages, Legal, M&E, and the owning Researcher.
- A different Researcher must receive the existing concealed `404` behavior.
- Read from object storage when enabled and local storage otherwise.
- Use the saved original filename in `Content-Disposition`, sanitized for safety.
- Return the saved content type.
- Missing storage content returns `404`; it must never be presented as a successful empty download.

## 4. Data model and migration

Add nullable metadata columns to `AgreementVersion` so existing rows remain valid:

- `original_filename`: string, recommended maximum 255 characters.
- `content_type`: string, recommended maximum 127 characters.
- `file_size`: integer large enough for byte counts.

Requirements:

- Create a reviewed Alembic migration under `backend/migrations/versions/`.
- Inspect the current migration head first. The worktree already contains notification migration work; do not create a competing or disconnected head accidentally.
- Expose the metadata through `AgreementVersionOut`.
- Keep `file` as the internal local path/object key; never expose storage credentials or a public bucket URL.
- Existing rows with null metadata must still download with safe fallbacks.

## 5. Storage behavior

The repository already has `backend/app/utils/storage.py`.

- If `settings.storage_enabled` is true, use the existing S3-compatible adapter for final upload/download.
- Otherwise, use `settings.upload_path` for local prototype storage.
- Keep storage keys generated by the server; never trust a user filename as a path.
- Normalize and sanitize only the user-facing filename.
- Do not redesign the entire storage layer.
- Do not migrate old files as part of this feature.

## 6. Frontend behavior

### 6.1 Approved for signing

For Linkages, the Documents area must show:

- `Download Word`
- `Download PDF`
- `Start signing`
- A short statement that this is the Legal-approved signing copy.

All HTTP must remain inside `frontend/src/lib/api.js` and `frontend/src/lib/backend.js` according to repository validation rules.

Do not build a public Google export URL in the browser. Call the authenticated backend endpoint.

### 6.2 Awaiting signatures

For Linkages, show:

- The same Word and PDF download choices.
- A file picker with `accept=".pdf,.docx"`.
- Visible help text: `PDF or DOCX, maximum 25 MB`.
- Lightweight client validation for extension and size to improve feedback.
- Backend errors must still be shown because backend validation is authoritative.

Before uploading, require an explicit confirmation:

> This file will become the official signed agreement and cannot be replaced. Continue?

Use the existing modal pattern where practical. Do not add a new modal framework.

### 6.3 Fully executed

All authorized viewers must see an `Official signed agreement` card containing, when available:

- Original filename.
- File type and human-readable size.
- Uploaded by.
- Upload timestamp.
- Download action.
- `Final, locked` status.

Only Linkages sees signing controls. Read access must not depend on displaying those controls.

### 6.4 Error behavior

- A `409` caused by post-approval modification must tell Linkages that the document changed and needs Legal approval again.
- Export, upload, and missing-file failures use the existing error/toast UI.
- Disable repeated clicks while export or upload is in progress.
- Preserve keyboard access and useful button labels.

## 7. Swarm roles and strict file ownership

Use one coordinator and three implementation agents. Do not allow two agents to edit the same production files concurrently.

### Agent A — Backend owner

Owns production backend changes only:

- `backend/app/integrations/google_drive.py`
- `backend/app/modules/agreements/models.py`
- `backend/app/modules/agreements/schemas.py`
- `backend/app/modules/agreements/router.py`
- `backend/app/modules/agreements/service.py`
- `backend/app/utils/storage.py` only if a narrowly required adapter correction is necessary
- one new migration under `backend/migrations/versions/`

Must not edit frontend or tests.

Deliverables:

- Export helper and endpoint.
- Modification-time enforcement.
- Read-only signing-stage reconciliation.
- Bounded validation and upload.
- Metadata persistence.
- Local/object-storage upload and download.
- Friendly download response.

### Agent B — Frontend owner

Owns frontend production and mock behavior only:

- `frontend/src/components/DocumentRepository.jsx`
- `frontend/src/lib/backend.js`
- `frontend/src/lib/normalize.js` only if metadata normalization requires it
- `frontend/src/lib/mockApi.js` only to mirror the real contract
- minimal relevant additions to `frontend/src/styles.css`

Must not edit backend or tests.

Deliverables:

- Word/PDF export controls.
- Upload restrictions and confirmation.
- Official-document metadata presentation.
- Loading and error handling.
- Mock behavior matching the real backend, not inventing a second workflow.

### Agent C — QA owner

Owns tests only:

- signing-related backend tests, preferably a focused new module
- `frontend/scripts/mock-smoke-test.mjs` only for signing-flow assertions

Must not edit production code or migrations. Must report real defects rather than weaken assertions.

Deliverables are listed in Section 8.

### Coordinator / Integrator

The coordinator:

- Resolves API-contract questions.
- Prevents overlapping edits.
- Reviews migration ancestry.
- Reviews security and workflow scope.
- Updates `backend/API_ENDPOINTS.md` and `frontend/BACKEND_API_CONTRACT.md` only after the implementation is stable.
- Runs final backend and frontend gates.
- Makes only integration fixes, not unrelated cleanup.

## 8. Required tests

### Workflow and approval integrity

- Unchanged approved Doc can transition with `start_signing`.
- Doc modified after approval causes `409`.
- Failed check leaves status unchanged.
- `doc_modified_after_approval` remains correct during `awaiting_signatures`.
- Signing-stage reconciliation is idempotent and sets managed participants to reader without touching unrelated/inherited access.

### Export

- Linkages exports PDF in both allowed statuses.
- Linkages exports DOCX in both allowed statuses.
- Response has correct MIME and meaningful filename.
- Researcher, Legal, and M&E cannot call the signing-copy endpoint.
- Invalid format and invalid status are rejected.
- Missing Doc and Drive failure are handled cleanly.
- Changed-after-approval export is rejected.

### Upload validation

- Valid PDF succeeds.
- Valid DOCX succeeds.
- Empty file rejected.
- Unsupported extension rejected.
- PDF content renamed `.docx` rejected.
- Malformed ZIP renamed `.docx` rejected.
- Oversized file rejected with `413`.
- Non-Linkages upload rejected.
- Upload outside `awaiting_signatures` rejected.
- Storage failure leaves agreement awaiting signatures.
- Database failure cleans up newly stored content where feasible.

### Finalization and download

- Successful upload creates exactly one final version.
- Agreement becomes `fully_executed` only after successful storage and database work.
- Further version creation remains rejected.
- Original filename, MIME, and size are returned.
- Friendly filename is used for download.
- Local-storage download works.
- Object-storage download path is exercised with mocks.
- Linkages, Legal, M&E, and owning Researcher can download.
- A different Researcher receives `404`.
- Missing stored content returns `404`.
- Existing notification recipients and expiry calculation remain correct.

### Frontend/mock smoke

- Linkages sees export controls at the two allowed statuses.
- Only Linkages sees upload controls.
- Picker declares PDF/DOCX acceptance.
- Oversized/unsupported selection is rejected before request.
- Confirmation is required.
- Successful final upload displays official metadata and download action.
- Other authorized roles see the final document but not signing controls.

## 9. Required verification gates

From `backend/`:

```bash
python -m alembic upgrade head
python -m pytest -q
```

Use the project's supported Python 3.13 environment. Do not “fix” Python 3.14 hangs by upgrading pinned dependencies.

From `frontend/`:

```bash
npm run check
```

Also run:

```bash
git diff --check
```

The coordinator must inspect the final diff and confirm that no unrelated notification, email, authentication, partner, or reporting behavior was changed.

## 10. Explicit exclusions — do not stray into these

- No Resend, SMTP, or other email work.
- No electronic signatures, signature drawing, certificates, or third-party signing provider.
- No partner portal or partner login.
- No new workflow statuses.
- No signed-document replacement, deletion, or amendment workflow.
- No OCR, document comparison engine, malware scanner, or background job system.
- No bulk storage migration.
- No public object-storage URLs.
- No changes to unrelated notification UI.
- No dependency upgrades unless the coordinator approves a proven blocker.
- No authorization shortcuts for demonstration purposes.

## 11. Stop and escalate conditions

An agent must stop and report to the coordinator if:

- Migration history has multiple heads or unclear ancestry.
- The existing reconciliation design cannot safely represent reader access without changing unrelated stages.
- Google Drive export is unavailable for the configured demo document.
- Existing dirty changes conflict with an owned file and intent cannot be preserved.
- Tests reveal that a requested rule contradicts an existing documented product invariant.
- Supporting `.doc` becomes a requirement; it must be an explicit product decision.

Do not guess through these conditions.

## 12. Definition of done

The feature is done only when Linkages can take an unchanged, Legal-approved Google Doc, download it as DOCX or PDF, upload a validated signed DOCX or PDF, and every authorized internal role plus the owning Researcher can reliably download the same immutable official file. Both full verification gates must pass, and the final diff must remain confined to this signing workflow.

## 13. Authoritative Google references

- Drive API `files.export`: <https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export>
- Download and export guidance: <https://developers.google.com/workspace/drive/api/guides/manage-downloads>
- Supported Google Workspace export MIME types: <https://developers.google.com/workspace/drive/api/guides/ref-export-formats>
