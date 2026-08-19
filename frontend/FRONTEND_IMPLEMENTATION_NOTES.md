# Frontend Implementation Notes

## Architecture

- `src/lib/api.js`: bearer-token HTTP transport, error normalization and secure file downloads.
- `src/lib/backend.js`: the only production API contract adapter.
- `src/lib/normalize.js`: maps backend responses to stable UI view models.
- `src/lib/workflow.js`: canonical lifecycle presentation and exact backend transition actions.
- `src/lib/mockApi.js`: optional exact-contract mock server used only when explicitly enabled.
- `src/context/AuthContext.jsx`: token lifecycle and `/auth/me` session validation.

## Important implementation decisions

1. **No automatic mock fallback.** A 401, network failure or backend error remains an error in real mode.
2. **Backend integer IDs.** Route parameters are converted to numbers before network calls.
3. **Backend-scoped lists.** Agreement data is never treated as globally visible merely because a page is accessible.
4. **No duplicated API paths in pages.** Pages call named integration functions.
5. **Correction compatibility.** Structured correction text is stored in transition comments until dedicated correction endpoints exist.
6. **M&E compatibility.** The six-month form writes supported deliverable, evidence and value records.
7. **Score transparency.** Client score previews show each component and weight and are not presented as stored official scores.
8. **Template honesty.** Template names shown in the request wizard are local guidance and are not submitted as nonexistent fields.
9. **Public partner honesty.** The registration form is visually complete but cannot submit until an approved public endpoint and partner identity model exist.
10. **Human review wording.** Generated narrative previews clearly require review and never claim that AI cannot hallucinate.

## Backend changes that would unlock future UI features

- Public partner registration, verification and authentication
- Partner-scoped document and correction access
- Template and configuration APIs
- Dedicated correction objects with field/clause links
- Six-month report workflow entities and validation status
- Governed scorecard persistence and configurable weights
- AI summary generation, approval and source links
- PDF and Excel report exports
- Password reset and email verification
- Notification delivery status and resend actions
