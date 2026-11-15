import { humanize } from "./format.js";

const BACKEND_STAGE_TO_CANONICAL = {
  initiation: "draft_documents",
  department_approval: "faculty_review",
  linkages_review: "linkages_review",
  legal_review: "legal_review",
  dvc_approval: "dvc_endorsement",
  vc_submission: "vc_submission",
  validation_signing: "signing",
  active: "me_reporting",
  renewal_closure: "renewal_closure",
  archived: "renewal_closure"
};

const STAGE_OFFICES = {
  initiation: "Researcher",
  department_approval: "Faculty / Department Approver",
  linkages_review: "Directorate of Linkages (RPE)",
  legal_review: "University Legal Office",
  dvc_approval: "DVC RPE",
  vc_submission: "Directorate of Linkages (RPE)",
  validation_signing: "VC Office / Partner Signatory",
  active: "Researcher / M&E",
  renewal_closure: "Director, Linkages",
  archived: "Institutional Archive"
};

const COLOR_RISK = {
  green: "low",
  blue: "low",
  yellow: "medium",
  orange: "high",
  red: "critical"
};

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function daysSince(value) {
  const date = toDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function splitOutcomes(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/\r?\n|;|\u2022/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function canonicalStage(stage, status) {
  if (stage === "validation_signing" && status === "fully_signed") return "signed_upload";
  if (stage === "active") return "me_reporting";
  return BACKEND_STAGE_TO_CANONICAL[stage] || stage || "draft_documents";
}

export function backendStageLabel(stage) {
  return humanize(stage || "Unknown stage");
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    id: Number(user.id),
    department: user.department || ""
  };
}

export function normalizePartner(partner) {
  if (!partner) return null;
  return {
    ...partner,
    id: Number(partner.id),
    institution_type: partner.partner_type,
    verification_status: partner.status,
    region: partner.country,
    website: "",
    researcher_name: null,
    active_agreements: null
  };
}

export function normalizeDocument(document) {
  if (!document) return null;
  const signed = document.document_type === "signed" && document.is_official;
  return {
    ...document,
    id: Number(document.id),
    name: document.original_name,
    type: document.document_type,
    size: Number(document.size_bytes || 0),
    status: signed ? "final_signed" : document.is_official ? "approved" : "uploaded",
    uploaded_at: document.created_at,
    uploaded_by: "Recorded by Accord360"
  };
}

export function normalizeWorkflowEvent(event) {
  if (!event) return null;
  return {
    ...event,
    id: Number(event.id),
    stage: canonicalStage(event.to_stage),
    backend_stage: event.to_stage,
    status: "completed",
    responsible: event.actor?.full_name || "Accord360 user",
    completed_at: event.created_at,
    created_at: event.created_at
  };
}

export function normalizeAgreementList(item) {
  if (!item) return null;
  const stage = canonicalStage(item.stage, item.status);
  return {
    ...item,
    id: Number(item.id),
    reference: item.reference_number,
    partner_id: item.partner?.id ? Number(item.partner.id) : null,
    partner_name: item.partner?.name || "Unknown partner",
    initiator_id: item.initiator?.id ? Number(item.initiator.id) : null,
    initiator_name: item.initiator?.full_name || item.owner?.full_name || "Unknown initiator",
    researcher_id: item.researcher?.id ? Number(item.researcher.id) : null,
    researcher_name: item.researcher?.full_name || null,
    stage,
    backend_stage: item.stage,
    backend_stage_label: backendStageLabel(item.stage),
    current_action: item.next_action || "No action recorded",
    next_office: STAGE_OFFICES[item.stage] || "Responsible office not exposed",
    days_in_stage: item.legal_review_days ?? daysSince(item.updated_at),
    risk: COLOR_RISK[item.status_color] || "low",
    status_color: item.status_color || "green"
  };
}

export function normalizeAgreementDetail(item) {
  if (!item) return null;
  const base = normalizeAgreementList(item);
  const workflowEvents = (item.workflow_events || []).map(normalizeWorkflowEvent).filter(Boolean);
  const currentStageEntry = {
    stage: base.stage,
    backend_stage: item.stage,
    status: "active",
    responsible: STAGE_OFFICES[item.stage] || "Responsible office",
    started_at: [...(item.workflow_events || [])].reverse().find((event) => event.to_stage === item.stage)?.created_at || item.updated_at
  };
  const lifecycleHistory = [...workflowEvents, currentStageEntry];
  const rawVersions = item.versions?.length ? item.versions : (item.documents || []).filter((document) => document.document_type === "signed" && document.is_official).map((document) => ({
    id: document.id,
    original_filename: document.original_name,
    content_type: document.mime_type,
    byte_size: document.size_bytes,
    file: document.file,
    is_final: true,
    status_at_time: "fully_executed",
    timestamp: document.created_at,
    uploaded_by: document.uploaded_by
  }));
  const agreementVersions = rawVersions.map((version) => ({
    id: Number(version.id),
    version_id: Number(version.id),
    name: version.original_filename || version.file?.split("/").pop() || `Agreement version ${version.id}`,
    original_filename: version.original_filename || null,
    content_type: version.content_type || null,
    byte_size: Number(version.byte_size ?? version.file_size ?? 0) || 0,
    file: version.file,
    type: version.is_final ? "final_signed" : "agreement_draft",
    version: version.status_at_time,
    status: version.is_final ? "final_signed" : "uploaded",
    is_final: version.is_final,
    uploaded_at: version.timestamp,
    timestamp: version.timestamp || version.uploaded_at,
    uploaded_by: version.uploaded_by?.full_name || version.uploaded_by || "Accord360",
    source: "agreement_version"
  }));
  const documents = agreementVersions.length
    ? agreementVersions
    : (item.documents || []).map(normalizeDocument).filter(Boolean);
  const legalComments = (item.workflow_events || [])
    .filter((event) => event.comment && ["return_correction", "return_dvc", "reject", "approve_legal", "send_legal"].includes(event.action))
    .map((event) => ({
      id: `event-${event.id}`,
      clause: event.action === "return_dvc" ? "DVC RPE remarks" : event.action === "return_correction" ? "Correction request" : humanize(event.action),
      author: event.actor?.full_name || "Accord360 user",
      created_at: event.created_at,
      text: event.comment,
      blocking: ["return_correction", "return_dvc", "reject"].includes(event.action),
      status: item.status === "correction_required" || item.status === "dvc_returned" ? "open" : "resolved"
    }));
  const vcEvent = [...(item.workflow_events || [])].reverse().find((event) => event.action === "record_vc_signature");
  const signedEvent = [...(item.workflow_events || [])].reverse().find((event) => event.action === "mark_signed");
  const isAtLeastVcSigned = ["awaiting_partner_signature", "fully_signed", "active", "renewal_review", "closed", "archived"].includes(item.status);
  const isFullySigned = ["fully_signed", "active", "renewal_review", "closed", "archived"].includes(item.status);
  const signedDocument = documents.find((document) => document.type === "signed" && document.is_official);

  return {
    ...base,
    purpose: item.purpose,
    expected_outcomes: splitOutcomes(item.expected_outcomes),
    strategic_alignment: item.strategic_alignment || "Not recorded",
    collaboration_area: item.purpose,
    faculty: "Not exposed by current backend",
    department: item.department,
    intended_start_date: item.effective_date,
    proposed_duration_months: item.effective_date && item.expiry_date
      ? Math.max(1, Math.round((new Date(item.expiry_date) - new Date(item.effective_date)) / 2629800000))
      : null,
    confidentiality: item.confidentiality,
    researcher_name: item.researcher?.full_name || null,
    researcher_id: item.researcher?.id ? Number(item.researcher.id) : null,
    partner_liaison_name: item.partner_liaison,
    documents,
    versions: agreementVersions,
    workflow_events: item.workflow_events || [],
    lifecycle_history: lifecycleHistory,
    deliverables: item.deliverables || [],
    values: item.values || [],
    initial_deliverables: item.deliverables || [],
    legal_comments: legalComments,
    corrections: legalComments.filter((comment) => comment.blocking).map((comment) => comment.id),
    template: null,
    signing: {
      vc_signed: isAtLeastVcSigned,
      vc_signed_at: vcEvent?.created_at || null,
      partner_signed: isFullySigned,
      partner_signed_at: signedEvent?.created_at || item.signing_date || null,
      fully_signed_uploaded: Boolean(signedDocument)
    }
  };
}

export function normalizeNotification(item) {
  if (!item) return null;
  const severity = item.severity || (item.level === "red" ? "critical" : item.level === "orange" ? "warning" : item.level === "yellow" ? "warning" : "info");
  return {
    ...item,
    id: Number(item.id),
    severity,
    category: item.category || "system",
    actor_name: item.actor_name || "System",
    agreement_title: item.agreement_title || null,
    action_url: item.action_url || (item.agreement_id ? `/agreements/${item.agreement_id}` : "/notifications"),
    requires_action: Boolean(item.requires_action),
    record_reference: item.agreement_title || (item.agreement_id ? `Agreement #${item.agreement_id}` : "System"),
    required_action: item.requires_action ? item.message : null,
    priority: severity === "critical" ? "critical" : severity === "warning" ? "high" : severity === "success" ? "normal" : "low"
  };
}

export function normalizeAudit(item) {
  if (!item) return null;
  return {
    ...item,
    id: Number(item.id),
    actor_name: item.actor?.full_name || "System",
    actor_role: item.actor?.role || "system",
    record_type: item.object_type,
    reference: item.object_id,
    details: item.new_value || item.old_value || "",
    timestamp: item.created_at,
    ip_address: item.source_ip || "—"
  };
}

export function normalizeDashboard(workspace, stats) {
  return {
    workspace,
    kpis: workspace?.metrics || [],
    queue: (workspace?.queue || []).map((item) => ({
      id: Number(item.id),
      title: item.title,
      partner_name: item.partner,
      department: item.department,
      status: item.status,
      researcher_name: item.researcher || null,
      updated_at: item.updated_at || null,
      returned_by_legal: Boolean(item.returned_by_legal)
    })),
    byStatus: stats?.by_status || [],
    monthlyCreated: (stats?.monthly_created || []).map((item) => ({
      ...item,
      label: new Date(`${item.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" })
    })),
    kpiTotals: stats?.kpis || {}
  };
}

export function calculateAgreementScore(agreement) {
  const deliverables = agreement?.deliverables || [];
  if (!deliverables.length) return { overall: 0, category: "No baseline", components: [] };
  const completion = deliverables.reduce((sum, item) => {
    const target = Number(item.target_value || 0);
    const actual = Number(item.actual_value || 0);
    return sum + (target > 0 ? Math.min(100, (actual / target) * 100) : actual > 0 ? 100 : 0);
  }, 0) / deliverables.length;
  const evidence = deliverables.filter((item) => item.evidence_document_id).length / deliverables.length * 100;
  const timeliness = agreement.status_color === "green" ? 90 : agreement.status_color === "yellow" ? 70 : agreement.status_color === "orange" ? 45 : 25;
  const value = (agreement.values || []).some((item) => Number(item.amount) > 0) ? 80 : 40;
  const components = [
    { name: "Deliverable achievement", weight: 50, score: Math.round(completion) },
    { name: "Evidence completeness", weight: 20, score: Math.round(evidence) },
    { name: "Compliance and timeliness", weight: 20, score: timeliness },
    { name: "Financial/resource value", weight: 10, score: value }
  ];
  const overall = Math.round(components.reduce((sum, item) => sum + item.score * item.weight / 100, 0));
  const category = overall >= 80 ? "Strong partnership" : overall >= 60 ? "Stable partnership" : overall >= 40 ? "At-risk partnership" : "Critical attention";
  return { overall, category, components };
}
