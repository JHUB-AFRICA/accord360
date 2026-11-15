# Accord360 Role-Based Workspaces

Accord360 has exactly four authenticated workspaces. Backend authorization is
the security boundary; frontend visibility is only a usability layer.

| Role | Workspace | Main permitted functions |
|---|---|---|
| Researcher | `/researcher` | Create structured requests, view own agreements, respond to corrections, submit quarterly progress updates for fully executed or expired agreements |
| Linkages | `/linkages` | View all agreements, manage templates and FieldDefinitions, upload legal/corrected/final drafts, coordinate workflow and signing |
| Legal | `/legal` | View all agreements, create/resolve version-scoped comments, request corrections, verify corrections and approve drafts; never upload files |
| M&E (`me`) | `/monitoring` | View portfolio progress and expiry state; Update or Archive agreements only while status is `expired` |

## Document handoff

1. The Researcher submits structured information; no document upload is shown.
2. The system generates the Researcher intake document and sends it to Linkages.
3. Linkages reviews the intake, prepares the legal agreement draft, and uploads
   the `.docx` draft.
4. Legal reviews the uploaded draft through version-scoped comments.
5. Linkages uploads corrected drafts and, after signing, the final signed scan.

Legal is intentionally read/write for comments and workflow decisions only. It
has no file-upload permission in the backend or frontend.
