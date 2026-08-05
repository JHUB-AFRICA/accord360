export const WORKFLOW_STAGES = [
  { key: "partner_inquiry", number: 1, label: "Partner inquiry", short: "Inquiry", responsible: "Public / Researcher" },
  { key: "partner_verification", number: 2, label: "Registration & verification", short: "Verification", responsible: "Linkages Directorate" },
  { key: "champion_assignment", number: 3, label: "Champion assignment", short: "Champion", responsible: "Linkages Directorate" },
  { key: "agreement_details", number: 4, label: "Agreement details & template", short: "Details", responsible: "Researcher / Champion" },
  { key: "draft_documents", number: 5, label: "Draft & document upload", short: "Documents", responsible: "Researcher / Champion" },
  { key: "faculty_review", number: 6, label: "Faculty review", short: "Faculty", responsible: "Faculty Approver", optional: true },
  { key: "linkages_review", number: 7, label: "Linkages review", short: "Linkages", responsible: "Linkages Officer" },
  { key: "legal_review", number: 8, label: "Legal review", short: "Legal", responsible: "Legal Reviewer" },
  { key: "legal_locked", number: 9, label: "Legal version locked", short: "Legal lock", responsible: "Legal Directorate" },
  { key: "dvc_endorsement", number: 10, label: "DVC RPE endorsement", short: "DVC RPE", responsible: "DVC RPE" },
  { key: "vc_submission", number: 11, label: "VC submission", short: "VC package", responsible: "VC Office" },
  { key: "signing", number: 12, label: "JKUAT & partner signing", short: "Signing", responsible: "VC Office & Partner" },
  { key: "signed_upload", number: 13, label: "Signed document upload", short: "Signed PDF", responsible: "Linkages Directorate" },
  { key: "activation", number: 14, label: "Activation", short: "Activation", responsible: "Linkages Directorate" },
  { key: "me_reporting", number: 15, label: "Six-month M&E reporting", short: "M&E", responsible: "Champion" },
  { key: "scoring", number: 16, label: "Collaboration scoring", short: "Scoring", responsible: "Linkages & System" },
  { key: "renewal_closure", number: 17, label: "Renewal, closure or archive", short: "Renewal", responsible: "Linkages Director" }
];

export const STAGE_LABELS = Object.fromEntries(WORKFLOW_STAGES.map((stage) => [stage.key, stage.label]));

export const STATUS_LABELS = {
  draft: "Draft",
  pending: "Pending",
  in_progress: "In progress",
  action_required: "Action required",
  correction_required: "Correction required",
  awaiting_response: "Awaiting response",
  ready: "Ready",
  approved: "Approved",
  active: "Active",
  overdue: "Overdue",
  returned: "Returned",
  rejected: "Rejected",
  closed: "Closed",
  archived: "Archived",
  awaiting_vc_signature: "Awaiting VC signature",
  awaiting_partner_signature: "Awaiting partner signature",
  fully_signed: "Fully signed",
  final_signed: "Final signed",
  under_review: "Under review",
  submitted: "Submitted",
  validated: "Validated",
  pending_review: "Pending review",
  additional_information_required: "Additional information required",
  verified: "Verified",
  not_started: "Not started",
  on_track: "On track",
  at_risk: "At risk",
  completed: "Completed",
  not_achieved: "Not achieved"
};

export const STATUS_TONES = {
  active: "green",
  approved: "green",
  verified: "green",
  completed: "green",
  fully_signed: "green",
  final_signed: "green",
  ready: "blue",
  in_progress: "blue",
  under_review: "blue",
  submitted: "blue",
  validated: "green",
  pending_review: "yellow",
  pending: "yellow",
  awaiting_response: "yellow",
  awaiting_vc_signature: "yellow",
  awaiting_partner_signature: "yellow",
  action_required: "orange",
  correction_required: "orange",
  additional_information_required: "orange",
  at_risk: "orange",
  overdue: "red",
  rejected: "red",
  returned: "red",
  closed: "slate",
  archived: "slate",
  draft: "slate",
  not_started: "slate",
  not_achieved: "red",
  on_track: "blue"
};

export const RISK_TONES = { low: "green", medium: "orange", high: "red", critical: "red" };

const ACTIONS = {
  submit: { label: "Submit request", roles: ["researcher", "linkages", "director_linkages"], stages: ["agreement_details", "draft_documents"], variant: "primary", requiresReason: false },
  approve_faculty: { label: "Approve faculty review", roles: ["approver"], stages: ["faculty_review"], variant: "primary" },
  return_correction: { label: "Return for correction", roles: ["approver", "linkages", "director_linkages", "legal", "dvc"], stages: ["faculty_review", "linkages_review", "legal_review", "dvc_endorsement"], variant: "secondary", requiresReason: true },
  reject: { label: "Reject", roles: ["approver", "linkages", "director_linkages", "legal", "dvc"], stages: ["faculty_review", "linkages_review", "legal_review", "dvc_endorsement"], variant: "danger", requiresReason: true },
  approve_linkages: { label: "Approve & send to Legal", roles: ["linkages", "director_linkages"], stages: ["linkages_review"], variant: "primary" },
  request_amendment: { label: "Request amendment", roles: ["legal"], stages: ["legal_review"], variant: "secondary", requiresReason: true },
  approve_legal: { label: "Approve & lock legal version", roles: ["legal"], stages: ["legal_review"], variant: "primary" },
  endorse_dvc: { label: "Endorse & forward", roles: ["dvc"], stages: ["dvc_endorsement"], variant: "primary" },
  release_vc: { label: "Release package for signing", roles: ["vc_office"], stages: ["vc_submission"], variant: "primary" },
  record_vc_signature: { label: "Record VC signature", roles: ["vc_office"], stages: ["signing"], variant: "primary" },
  record_partner_signature: { label: "Record partner signature", roles: ["vc_office"], stages: ["signing"], variant: "primary" },
  upload_signed: { label: "Upload fully signed PDF", roles: ["vc_office", "linkages", "director_linkages"], stages: ["signing", "signed_upload"], variant: "primary" },
  activate: { label: "Activate agreement", roles: ["linkages", "director_linkages"], stages: ["signed_upload", "activation"], variant: "primary" },
  submit_me_report: { label: "Submit six-month report", roles: ["researcher", "me", "director_linkages"], stages: ["activation", "me_reporting"], variant: "primary" },
  validate_me_report: { label: "Validate M&E report", roles: ["me", "linkages", "director_linkages"], stages: ["me_reporting"], variant: "primary" },
  score: { label: "Calculate score", roles: ["me", "linkages", "director_linkages"], stages: ["me_reporting", "scoring", "activation"], variant: "primary" },
  renew: { label: "Start renewal", roles: ["director_linkages", "linkages"], stages: ["activation", "me_reporting", "scoring", "renewal_closure"], variant: "primary" },
  close: { label: "Close agreement", roles: ["director_linkages"], stages: ["activation", "me_reporting", "scoring", "renewal_closure"], variant: "danger", requiresReason: true },
  archive: { label: "Archive agreement", roles: ["director_linkages"], stages: ["renewal_closure"], variant: "secondary", requiresReason: true }
};

export function stageIndex(stageKey) {
  return Math.max(0, WORKFLOW_STAGES.findIndex((stage) => stage.key === stageKey));
}

export function getActionDefinition(key) {
  return ACTIONS[key];
}

export function getAvailableActions(record, role) {
  if (!record || !role || ["executive", "auditor", "admin", "partner"].includes(role)) return [];
  return Object.entries(ACTIONS)
    .filter(([, action]) => action.roles.includes(role) && action.stages.includes(record.stage))
    .filter(([key]) => {
      if (key === "approve_legal") return !(record.legal_comments || []).some((comment) => comment.blocking && comment.status !== "resolved");
      if (key === "activate") return record.status === "fully_signed" || record.stage === "signed_upload";
      if (key === "record_vc_signature") return !record.signing?.vc_signed;
      if (key === "record_partner_signature") return record.signing?.vc_signed && !record.signing?.partner_signed;
      if (key === "upload_signed") return record.signing?.vc_signed && record.signing?.partner_signed && !record.signing?.fully_signed_uploaded;
      return true;
    })
    .map(([key, action]) => ({ key, ...action }));
}

export function applyWorkflowAction(record, actionKey, payload = {}) {
  const next = structuredClone(record);
  const now = new Date().toISOString();
  const addHistory = (stage, status, responsible) => {
    const existing = next.lifecycle_history.find((entry) => entry.stage === stage && entry.status === "active");
    if (existing) {
      existing.status = "completed";
      existing.completed_at = now.slice(0, 10);
    } else {
      next.lifecycle_history.push({ stage, status: "completed", completed_at: now.slice(0, 10), responsible });
    }
  };
  const startStage = (stage, responsible) => {
    next.lifecycle_history.push({ stage, status: "active", started_at: now.slice(0, 10), responsible });
    next.stage = stage;
    next.days_in_stage = 0;
  };

  switch (actionKey) {
    case "submit":
      addHistory(next.stage, "completed", "Researcher / Champion");
      startStage("faculty_review", "Faculty Approver");
      next.status = "pending";
      next.current_action = "Faculty academic-fit review";
      next.next_office = "Faculty Approver";
      break;
    case "approve_faculty":
      addHistory("faculty_review", "completed", "Faculty Approver");
      startStage("linkages_review", "Linkages Officer");
      next.status = "pending";
      next.current_action = "Linkages strategic and completeness review";
      next.next_office = "Directorate of Linkages (RPE)";
      break;
    case "approve_linkages":
    case "send_legal":
      addHistory("linkages_review", "completed", "Linkages Officer");
      startStage("legal_review", "Legal Reviewer");
      next.status = "in_progress";
      next.current_action = "Legal clause and compliance review";
      next.next_office = "University Legal Office";
      break;
    case "approve_legal":
      addHistory("legal_review", "completed", "Legal Reviewer");
      next.lifecycle_history.push({ stage: "legal_locked", status: "completed", completed_at: now.slice(0, 10), responsible: "Legal Directorate" });
      if (next.template) next.template.locked = true;
      startStage("dvc_endorsement", "DVC RPE");
      next.status = "pending";
      next.current_action = "DVC RPE endorsement";
      next.next_office = "DVC RPE";
      break;
    case "endorse_dvc":
      addHistory("dvc_endorsement", "completed", "DVC RPE");
      startStage("vc_submission", "VC Office");
      next.status = "ready";
      next.current_action = "Release complete package to VC Office";
      next.next_office = "VC Office";
      break;
    case "release_vc":
      addHistory("vc_submission", "completed", "VC Office");
      startStage("signing", "VC Office & Partner");
      next.status = "awaiting_vc_signature";
      next.signing = { ...(next.signing || {}), vc_signed: false, partner_signed: false, fully_signed_uploaded: false };
      next.current_action = "VC signature";
      next.next_office = "VC Office";
      break;
    case "record_vc_signature":
      next.signing = { ...(next.signing || {}), vc_signed: true, vc_signed_at: payload.date || now.slice(0, 10) };
      next.status = "awaiting_partner_signature";
      next.current_action = "Partner signature";
      next.next_office = "Partner Signatory";
      break;
    case "record_partner_signature":
      next.signing = { ...(next.signing || {}), partner_signed: true, partner_signed_at: payload.date || now.slice(0, 10) };
      next.status = "fully_signed";
      next.current_action = "Upload fully signed agreement";
      next.next_office = "VC Office / Linkages";
      break;
    case "upload_signed":
      addHistory("signing", "completed", "VC Office & Partner");
      next.signing = { ...(next.signing || {}), fully_signed_uploaded: true };
      startStage("signed_upload", "Linkages Directorate");
      next.status = "fully_signed";
      next.current_action = "Complete activation checklist";
      next.next_office = "Directorate of Linkages (RPE)";
      break;
    case "activate":
      addHistory("signed_upload", "completed", "Linkages Directorate");
      startStage("activation", "Linkages Directorate");
      next.status = "active";
      next.effective_date = payload.effective_date || now.slice(0, 10);
      next.expiry_date = payload.expiry_date || next.expiry_date;
      next.partner_liaison_name = payload.partner_liaison_name || next.partner_liaison_name;
      next.initial_deliverables = payload.initial_deliverable
        ? [...(next.initial_deliverables || []), { id: `deliverable-${Date.now()}`, output: payload.initial_deliverable, status: "not_started" }]
        : (next.initial_deliverables || []);
      next.current_action = "Six-month implementation monitoring";
      next.next_office = "Champion / M&E";
      break;
    case "return_correction":
    case "request_amendment":
      next.status = "correction_required";
      next.current_action = payload.reason || "Respond to requested corrections";
      next.next_office = payload.requested_from || "Initiator / Linkages";
      break;
    case "reject":
      next.status = "rejected";
      next.current_action = payload.reason || "Request rejected";
      next.next_office = "No further action";
      break;
    case "renew":
      next.stage = "renewal_closure";
      next.status = "in_progress";
      next.current_action = "Prepare renewal decision and updated agreement";
      next.next_office = "Director, Linkages";
      break;
    case "close":
      next.stage = "renewal_closure";
      next.status = "closed";
      next.current_action = payload.reason || "Agreement closed";
      next.next_office = "Archive";
      break;
    case "archive":
      next.status = "archived";
      next.current_action = payload.reason || "Agreement archived";
      next.next_office = "Archive";
      break;
    default:
      break;
  }
  next.updated_at = now;
  return next;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || "Unknown").replaceAll("_", " ");
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || String(stage || "Unknown").replaceAll("_", " ");
}
