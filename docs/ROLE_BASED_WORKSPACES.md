# Accord 360 Role-Based Workspaces

The application is one secure JKUAT platform, but every authenticated role is routed to a different workspace, navigation menu, data scope and set of permitted actions.

| Role | Home workspace | Main permitted functions |
|---|---|---|
| JKUAT Champion (`researcher`) | `/champion` | Create own requests, submit, track progress, respond to corrections, upload permitted files, update M&E for owned active agreements |
| Department / Faculty Approver (`approver`) | `/approvals` | View department/assigned requests and approve, return or reject at the department gate |
| Linkages Officer (`linkages`) | `/linkages` | Log requests, conduct Linkages review, route to Legal, submit DVC-endorsed packages to VC, coordinate signing, activate and renew |
| Director, Linkages (`director_linkages`) | `/linkages` | Full directorate oversight, escalations, operational actions, reports, audit review and renewal decisions |
| Legal Office Reviewer (`legal`) | `/legal` | Review legal-stage drafts, upload legal versions, return feedback and approve the legal version |
| DVC RPE (`dvc`) | `/dvc` | Endorse or return legally approved packages; cannot issue Legal or VC actions |
| VC Office (`vc_office`) | `/signing` | Track VC and partner signature milestones, update signing dates, upload official signed files and mark fully signed |
| M&E Officer (`me`) | `/monitoring` | Update deliverables, evidence and value records for active collaborations; monitor dormancy and expiry risk |
| Executive Viewer (`executive`) | `/executive` | Read-only executive KPIs, portfolio drill-down and reports |
| System Administrator (`admin`) | `/admin` | User/role administration, settings and audit; cannot forge business workflow approvals |
| Auditor (`auditor`) | `/audit-workspace` | Read-only authorized records, reports and audit history |

## Enforced workflow gates

```text
Champion initiation
→ Department / Faculty approval
→ Linkages review
→ Legal Office review and approval
→ DVC RPE endorsement
→ Linkages submission to VC Office
→ VC / partner signing
→ Linkages activation
→ M&E reporting
→ Renewal / closure / archive
```

The backend validates both the user's role and the agreement's current stage/status for every transition. Hiding a button in the frontend is not treated as security; unauthorized API calls return HTTP 403.
