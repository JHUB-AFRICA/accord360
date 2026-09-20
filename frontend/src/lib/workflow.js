// REBUILD_BRIEF.md Section 1 (Phase 0 removal): WORKFLOW_STAGES (the 17-entry
// stage list), STAGE_LABELS (derived from it), ACTIONS, CANONICAL_INDEX_BY_BACKEND,
// stageIndex() and getAvailableActions() have been deleted. They encoded the
// rejected 11-role/17-stage workflow and must not coexist with the new
// 9-status model (REBUILD_BRIEF.md Section 2.2-2.4).
//
// TODO(spec): rebuild status/action logic from scratch against
// REBUILD_BRIEF.md Section 2.3 (status permission matrix) and Section 5.2
// (action-button visibility) in a later phase. Per Section 5.2, prefer
// deriving `available_actions` from the backend API response rather than
// re-implementing a client-side copy of the permission matrix.
//
// The following consumers imported the now-removed symbols and are left with
// broken imports/usages, flagged inline, for a later phase agent to rebuild:
//   - frontend/src/components/WorkflowTimeline.jsx (WORKFLOW_STAGES, stageIndex)
//   - frontend/src/pages/AgreementDetail.jsx (getAvailableActions, stageLabel)
//   - frontend/src/pages/Agreements.jsx (stageLabel)
//   - frontend/src/pages/Dashboard.jsx (stageLabel)
//   - frontend/src/pages/PartnerDetail.jsx (stageLabel)
//
// STATUS_LABELS/STATUS_TONES/RISK_TONES/statusLabel() are retained below
// (not named for removal in Section 1, and still used by StatusBadge.jsx /
// Dashboard.jsx / Agreements.jsx's shared table pattern which are explicitly
// "do NOT remove"). NOTE: these still contain old 17-stage-era status
// strings alongside the 9 new ones — Phase 1 should reconcile this against
// REBUILD_BRIEF.md Section 2.2's exact 9-status list.

export const STATUS_LABELS = {
  draft: "Draft",
  pending_department: "Pending department approval",
  pending_linkages: "Pending Linkages review",
  linkages_approved: "Linkages approved",
  in_legal_review: "In Legal review",
  pending_legal: "Pending Legal review",
  legal_stalled: "Legal review overdue",
  legal_approved: "Legal approved",
  dvc_returned: "Returned by DVC RPE",
  dvc_approved: "DVC RPE endorsed",
  awaiting_vc_signature: "Awaiting VC signature",
  awaiting_partner_signature: "Awaiting partner signature",
  fully_signed: "Fully signed",
  active: "Active",
  expiry_warning: "Expiry warning",
  expiry_critical: "Expiry critical",
  dormant: "Dormant",
  renewal_review: "Renewal review",
  correction_required: "Correction required",
  rejected: "Rejected",
  closed: "Closed",
  archived: "Archived",
  uploaded: "Uploaded",
  approved: "Approved",
  final_signed: "Final signed",
  open: "Open",
  resolved: "Resolved"
};

export const STATUS_TONES = {
  active: "green",
  approved: "green",
  legal_approved: "green",
  dvc_approved: "green",
  fully_signed: "green",
  final_signed: "green",
  resolved: "green",
  linkages_approved: "green",
  pending_department: "yellow",
  pending_linkages: "yellow",
  pending_legal: "yellow",
  awaiting_vc_signature: "yellow",
  awaiting_partner_signature: "yellow",
  in_legal_review: "blue",
  draft: "slate",
  correction_required: "orange",
  dvc_returned: "orange",
  expiry_warning: "orange",
  renewal_review: "orange",
  legal_stalled: "red",
  expiry_critical: "red",
  dormant: "red",
  rejected: "red",
  closed: "slate",
  archived: "slate",
  uploaded: "blue",
  open: "orange"
};

export const RISK_TONES = { low: "green", medium: "yellow", high: "orange", critical: "red" };

export function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || "Unknown").replaceAll("_", " ");
}
