// The 9 real agreement statuses (REBUILD_BRIEF.md Section 2.2), in order.
export const WORKFLOW_STATUSES = [
  "draft_generated", "pending_legal_review", "returned_for_corrections",
  "pending_legal_verification", "approved_for_signing", "awaiting_signatures",
  "fully_executed", "expired", "archived"
];

export const STATUS_LABELS = {
  draft_generated: "Draft generated",
  pending_legal_review: "Pending Legal review",
  returned_for_corrections: "Returned for corrections",
  pending_legal_verification: "Pending Legal verification",
  approved_for_signing: "Approved for signing",
  awaiting_signatures: "Awaiting signatures",
  fully_executed: "Fully executed",
  expired: "Expired",
  archived: "Archived",
  open: "Open",
  resolved: "Resolved",
  active: "Active",
  under_review: "Under review",
  additional_information_required: "Needs more information",
  rejected: "Rejected"
};

export const STATUS_TONES = {
  draft_generated: "slate",
  pending_legal_review: "yellow",
  returned_for_corrections: "orange",
  pending_legal_verification: "yellow",
  approved_for_signing: "blue",
  awaiting_signatures: "blue",
  fully_executed: "green",
  expired: "orange",
  archived: "slate",
  open: "orange",
  resolved: "green",
  active: "green",
  under_review: "yellow",
  additional_information_required: "orange",
  rejected: "red"
};

export const RISK_TONES = { low: "green", medium: "yellow", high: "orange", critical: "red" };

// Whose turn it is at each status (REBUILD_BRIEF.md Section 2.3/2.4 — mirrors
// the permission matrix already enforced server-side in access.py/TRANSITIONS,
// not a separate guess). Terminal/locked statuses have no responsible party.
export const STATUS_RESPONSIBLE = {
  draft_generated: "Linkages — prepare and upload the agreement draft",
  pending_legal_review: "Legal — review the draft",
  returned_for_corrections: "Linkages — upload the corrected draft",
  pending_legal_verification: "Legal — verify the corrections",
  approved_for_signing: "Linkages — start the signing process",
  awaiting_signatures: "Linkages — coordinate physical signing, then upload the signed scan",
  fully_executed: "No one — fully executed and locked",
  expired: "M&E — update or archive",
  archived: "No one — archived"
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || "Unknown").replaceAll("_", " ");
}

export function statusResponsible(status) {
  return STATUS_RESPONSIBLE[status] || "Not applicable";
}
