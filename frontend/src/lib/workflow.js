export const WORKFLOW_STAGES = [
  { key: "partner_inquiry", number: 1, label: "Partner inquiry", responsible: "Public / Researcher" },
  { key: "partner_verification", number: 2, label: "Registration & verification", responsible: "Linkages Directorate" },
  { key: "champion_assignment", number: 3, label: "Champion assignment", responsible: "Linkages Directorate" },
  { key: "agreement_details", number: 4, label: "Agreement details & template", responsible: "Researcher / Champion" },
  { key: "draft_documents", number: 5, label: "Draft & document upload", responsible: "Researcher / Champion" },
  { key: "faculty_review", number: 6, label: "Faculty review", responsible: "Faculty Approver", optional: true },
  { key: "linkages_review", number: 7, label: "Linkages review", responsible: "Linkages Officer" },
  { key: "legal_review", number: 8, label: "Legal review", responsible: "Legal Reviewer" },
  { key: "legal_locked", number: 9, label: "Legal version approved", responsible: "Legal Directorate" },
  { key: "dvc_endorsement", number: 10, label: "DVC RPE endorsement", responsible: "DVC RPE" },
  { key: "vc_submission", number: 11, label: "VC submission", responsible: "Directorate / VC Office" },
  { key: "signing", number: 12, label: "JKUAT & partner signing", responsible: "VC Office & Partner" },
  { key: "signed_upload", number: 13, label: "Signed document upload", responsible: "VC Office / Linkages" },
  { key: "activation", number: 14, label: "Activation", responsible: "Linkages Directorate" },
  { key: "me_reporting", number: 15, label: "Six-month M&E reporting", responsible: "Champion / M&E" },
  { key: "scoring", number: 16, label: "Collaboration scoring", responsible: "Frontend calculation / future backend" },
  { key: "renewal_closure", number: 17, label: "Renewal, closure or archive", responsible: "Linkages Director" }
];

export const STAGE_LABELS = Object.fromEntries(WORKFLOW_STAGES.map((stage) => [stage.key, stage.label]));

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

const ACTIONS = {
  submit: { label: "Submit request", roles: ["researcher", "linkages", "director_linkages"], backendStages: ["initiation"], statuses: ["draft", "correction_required"], variant: "primary" },
  approve_department: { label: "Approve faculty review", roles: ["approver"], backendStages: ["department_approval"], statuses: ["pending_department"], variant: "primary" },
  return_correction: { label: "Return for correction", roles: ["approver", "linkages", "director_linkages", "legal"], backendStages: ["department_approval", "linkages_review", "legal_review"], variant: "secondary", requiresReason: true },
  approve_linkages: { label: "Approve Linkages review", roles: ["linkages", "director_linkages"], backendStages: ["linkages_review"], statuses: ["pending_linkages"], variant: "primary" },
  send_legal: { label: "Send approved request to Legal", roles: ["linkages", "director_linkages"], backendStages: ["linkages_review"], statuses: ["linkages_approved"], variant: "primary" },
  approve_legal: { label: "Approve Legal draft", roles: ["legal"], backendStages: ["legal_review"], statuses: ["in_legal_review", "pending_legal", "legal_stalled", "dvc_returned"], variant: "primary" },
  approve_dvc: { label: "Endorse & forward", roles: ["dvc"], backendStages: ["dvc_approval"], statuses: ["legal_approved"], variant: "primary" },
  return_dvc: { label: "Return with DVC remarks", roles: ["dvc"], backendStages: ["dvc_approval"], statuses: ["legal_approved"], variant: "secondary", requiresReason: true },
  submit_vc: { label: "Submit endorsed package to VC", roles: ["linkages", "director_linkages"], backendStages: ["vc_submission"], statuses: ["dvc_approved"], variant: "primary" },
  record_vc_signature: { label: "Record VC signature", roles: ["vc_office"], backendStages: ["validation_signing"], statuses: ["awaiting_vc_signature"], variant: "primary" },
  mark_signed: { label: "Mark partner signature complete", roles: ["vc_office", "linkages", "director_linkages"], backendStages: ["validation_signing"], statuses: ["awaiting_partner_signature"], variant: "primary" },
  upload_official_signed: { label: "Upload official signed PDF", roles: ["vc_office", "linkages", "director_linkages"], backendStages: ["validation_signing"], statuses: ["fully_signed"], variant: "secondary", frontendOnly: true },
  activate: { label: "Activate agreement", roles: ["linkages", "director_linkages"], backendStages: ["validation_signing"], statuses: ["fully_signed"], variant: "primary" },
  renew: { label: "Start renewal", roles: ["linkages", "director_linkages"], backendStages: ["active"], variant: "primary" },
  close: { label: "Close agreement", roles: ["linkages", "director_linkages"], backendStages: ["active", "renewal_closure"], variant: "danger", requiresReason: true },
  archive: { label: "Archive agreement", roles: ["linkages", "director_linkages"], backendStages: ["renewal_closure"], statuses: ["closed"], variant: "secondary" },
  reject: { label: "Reject", roles: ["approver", "linkages", "director_linkages", "legal", "dvc"], backendStages: ["department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"], variant: "danger" }
};

const CANONICAL_INDEX_BY_BACKEND = {
  initiation: 4,
  department_approval: 5,
  linkages_review: 6,
  legal_review: 7,
  dvc_approval: 9,
  vc_submission: 10,
  validation_signing: 11,
  active: 14,
  renewal_closure: 16,
  archived: 16
};

export function stageIndex(stageKey, backendStage, status) {
  if (backendStage) {
    if (backendStage === "validation_signing" && status === "fully_signed") return 12;
    return CANONICAL_INDEX_BY_BACKEND[backendStage] ?? 0;
  }
  return Math.max(0, WORKFLOW_STAGES.findIndex((stage) => stage.key === stageKey));
}

export function getAvailableActions(record, role) {
  if (!record || !role || ["executive", "auditor", "admin"].includes(role)) return [];
  return Object.entries(ACTIONS)
    .filter(([, action]) => action.roles.includes(role))
    .filter(([, action]) => action.backendStages.includes(record.backend_stage || record.stage))
    .filter(([, action]) => !action.statuses || action.statuses.includes(record.status))
    .filter(([key]) => key !== "upload_official_signed" || !record.signing?.fully_signed_uploaded)
    .filter(([key]) => key !== "activate" || record.signing?.fully_signed_uploaded)
    .map(([key, action]) => ({ key, ...action }));
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || "Unknown").replaceAll("_", " ");
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || String(stage || "Unknown").replaceAll("_", " ");
}
