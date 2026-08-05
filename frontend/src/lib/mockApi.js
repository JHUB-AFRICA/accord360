import {
  agreements as seedAgreements,
  auditEvents as seedAuditEvents,
  configuration as seedConfiguration,
  corrections as seedCorrections,
  dashboardTotals,
  meReports as seedMeReports,
  notifications as seedNotifications,
  partners as seedPartners,
  scorecards as seedScorecards,
  templates as seedTemplates,
  users as seedUsers
} from "../data/mockData.js";
import { applyWorkflowAction, getAvailableActions, stageLabel, statusLabel } from "./workflow.js";

const STORAGE_KEY = "accord360_mock_database_v4";
const TOKEN_PREFIX = "mock-token:";

function clone(value) {
  return structuredClone(value);
}

function initialState() {
  return {
    users: clone(seedUsers),
    partners: clone(seedPartners),
    agreements: clone(seedAgreements),
    corrections: clone(seedCorrections),
    notifications: clone(seedNotifications),
    meReports: clone(seedMeReports),
    scorecards: clone(seedScorecards),
    templates: clone(seedTemplates),
    configuration: clone(seedConfiguration),
    auditEvents: clone(seedAuditEvents),
    partnerApplications: [],
    reportDrafts: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = initialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
    const parsed = JSON.parse(raw);
    return { ...initialState(), ...parsed };
  } catch {
    const state = initialState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function text(data, status = 200, headers = {}) {
  return new Response(data, { status, headers });
}

function error(detail, status = 400) {
  return json({ detail }, status);
}

function tokenFromHeaders(headers) {
  const authorization = new Headers(headers || {}).get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function userFromToken(state, token) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  return state.users.find((user) => user.id === token.slice(TOKEN_PREFIX.length)) || null;
}

function requestUser(state, options) {
  return userFromToken(state, tokenFromHeaders(options.headers));
}

async function parseBody(options) {
  if (!options.body) return {};
  if (options.body instanceof FormData) {
    const result = {};
    for (const [key, value] of options.body.entries()) result[key] = value;
    return result;
  }
  if (typeof options.body === "string") {
    try {
      return JSON.parse(options.body);
    } catch {
      return {};
    }
  }
  return options.body;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function addAudit(state, user, action, recordType, reference, details, severity = "info") {
  state.auditEvents.unshift({
    id: makeId("aud"),
    timestamp: new Date().toISOString(),
    actor: user?.full_name || "Public user",
    actor_role: user?.role || "Public",
    action,
    record_type: recordType,
    reference,
    details,
    ip_address: "127.0.0.1",
    severity
  });
}

function addNotification(state, { userId = null, role = null, title, reference, action, link, priority = "normal", dueDate = null, sender = "Accord360" }) {
  state.notifications.unshift({
    id: makeId("ntf"),
    user_id: userId,
    role,
    title,
    record_reference: reference,
    required_action: action,
    due_date: dueDate,
    sender,
    link,
    priority,
    escalation_level: priority === "critical" ? 2 : priority === "high" ? 1 : 0,
    email_status: "queued",
    is_read: false,
    created_at: new Date().toISOString(),
    reminder_history: []
  });
}

function scopedAgreements(state, user) {
  if (!user) return [];
  const all = state.agreements;
  if (["linkages", "director_linkages", "executive", "admin", "auditor"].includes(user.role)) return all;
  if (user.role === "researcher") return all.filter((item) => item.initiator_id === user.id || item.champion_id === user.id);
  if (user.role === "approver") return all.filter((item) => item.faculty === user.faculty || item.assigned_reviewer_id === user.id);
  if (user.role === "legal") return all.filter((item) => item.stage === "legal_review" || item.assigned_reviewer_id === user.id || item.lifecycle_history?.some((entry) => entry.stage === "legal_review"));
  if (user.role === "dvc") return all.filter((item) => ["dvc_endorsement", "vc_submission", "signing", "signed_upload", "activation"].includes(item.stage));
  if (user.role === "vc_office") return all.filter((item) => ["vc_submission", "signing", "signed_upload", "activation"].includes(item.stage));
  if (user.role === "me") return all.filter((item) => ["activation", "me_reporting", "scoring", "renewal_closure"].includes(item.stage));
  if (user.role === "partner") return all.filter((item) => item.partner_id === user.partner_id);
  return [];
}

function scopedCorrections(state, user) {
  if (!user) return [];
  if (["linkages", "director_linkages", "auditor", "admin"].includes(user.role)) return state.corrections;
  if (user.role === "legal") return state.corrections.filter((item) => item.requested_by_id === user.id || item.requested_from_role === "legal");
  if (user.role === "partner") return state.corrections.filter((item) => item.requested_from_id === user.id || state.agreements.find((agreement) => agreement.id === item.agreement_id)?.partner_id === user.partner_id);
  return state.corrections.filter((item) => item.requested_from_id === user.id || state.agreements.find((agreement) => agreement.id === item.agreement_id)?.initiator_id === user.id);
}

function scopedMeReports(state, user) {
  if (!user) return [];
  if (["me", "linkages", "director_linkages", "executive", "auditor"].includes(user.role)) return state.meReports;
  if (user.role === "researcher") return state.meReports.filter((item) => item.champion_id === user.id);
  if (user.role === "partner") {
    const partnerAgreementIds = new Set(state.agreements.filter((agreement) => agreement.partner_id === user.partner_id).map((agreement) => agreement.id));
    return state.meReports.filter((item) => partnerAgreementIds.has(item.agreement_id) && item.status === "validated");
  }
  return [];
}

function dashboardFor(state, user) {
  const records = scopedAgreements(state, user);
  const openCorrections = scopedCorrections(state, user).filter((item) => !["resolved", "closed"].includes(item.status));
  const roleKpis = {
    researcher: [
      { label: "My drafts", value: records.filter((item) => item.status === "draft").length || 2, tone: "slate" },
      { label: "Awaiting correction", value: openCorrections.length, tone: "orange" },
      { label: "Under review", value: records.filter((item) => ["pending", "in_progress"].includes(item.status)).length, tone: "blue" },
      { label: "Active partnerships", value: records.filter((item) => item.status === "active").length, tone: "green" }
    ],
    approver: [
      { label: "Awaiting my review", value: records.filter((item) => item.stage === "faculty_review").length, tone: "orange" },
      { label: "Approved this month", value: 6, tone: "green" },
      { label: "Returned by me", value: 2, tone: "slate" },
      { label: "Average turnaround", value: "3.2 days", tone: "blue" }
    ],
    linkages: [
      { label: "Requests in pipeline", value: dashboardTotals.requests_in_pipeline, tone: "blue" },
      { label: "Pending Linkages review", value: dashboardTotals.pending_linkages, tone: "orange" },
      { label: "Partner verifications", value: state.partners.filter((item) => item.verification_status !== "verified").length, tone: "orange" },
      { label: "Awaiting signatures", value: dashboardTotals.awaiting_signatures, tone: "green" }
    ],
    director_linkages: [
      { label: "Total partnerships", value: dashboardTotals.total_partnerships, tone: "blue" },
      { label: "Active agreements", value: dashboardTotals.active_agreements, tone: "green" },
      { label: "Active escalations", value: 3, tone: "red" },
      { label: "Expiring in 90 days", value: dashboardTotals.expiring_90_days, tone: "orange" }
    ],
    legal: [
      { label: "In queue", value: records.filter((item) => item.stage === "legal_review").length, tone: "orange" },
      { label: "Blocking comments", value: records.flatMap((item) => item.legal_comments || []).filter((item) => item.blocking && item.status !== "resolved").length, tone: "red" },
      { label: "Approved this week", value: 4, tone: "green" },
      { label: "Average review", value: "6.2 days", tone: "blue" }
    ],
    dvc: [
      { label: "Awaiting endorsement", value: records.filter((item) => item.stage === "dvc_endorsement").length, tone: "orange" },
      { label: "Returned packages", value: 1, tone: "slate" },
      { label: "Endorsed this month", value: 5, tone: "green" },
      { label: "Average endorsement", value: "2.3 days", tone: "blue" }
    ],
    vc_office: [
      { label: "Packages received", value: records.filter((item) => item.stage === "vc_submission").length, tone: "blue" },
      { label: "Awaiting VC signature", value: records.filter((item) => item.status === "awaiting_vc_signature").length, tone: "orange" },
      { label: "Partner signature pending", value: records.filter((item) => item.status === "awaiting_partner_signature").length, tone: "orange" },
      { label: "Executed this quarter", value: 4, tone: "green" }
    ],
    me: [
      { label: "Assigned partnerships", value: records.length, tone: "blue" },
      { label: "Due six-month reports", value: state.meReports.filter((item) => item.status !== "validated").length, tone: "orange" },
      { label: "Overdue deliverables", value: 2, tone: "red" },
      { label: "M&E completion rate", value: `${dashboardTotals.me_completion_rate}%`, tone: "green" }
    ],
    executive: [
      { label: "Total partnerships", value: dashboardTotals.total_partnerships, tone: "blue" },
      { label: "Active agreements", value: dashboardTotals.active_agreements, tone: "green" },
      { label: "Average approval time", value: `${dashboardTotals.average_approval_days} days`, tone: "orange" },
      { label: "M&E completion rate", value: `${dashboardTotals.me_completion_rate}%`, tone: "green" }
    ],
    admin: [
      { label: "Active users", value: state.users.filter((item) => item.is_active).length, tone: "green" },
      { label: "Configured roles", value: new Set(state.users.map((item) => item.role)).size, tone: "blue" },
      { label: "Agreement types", value: state.configuration.agreement_types.length, tone: "slate" },
      { label: "Audit events today", value: state.auditEvents.filter((item) => item.timestamp.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, tone: "orange" }
    ],
    auditor: [
      { label: "Authorized records", value: records.length, tone: "blue" },
      { label: "Audit events", value: state.auditEvents.length, tone: "slate" },
      { label: "High-risk agreements", value: dashboardTotals.dormant_or_high_risk, tone: "red" },
      { label: "Open corrections", value: state.corrections.filter((item) => item.status !== "resolved").length, tone: "orange" }
    ],
    partner: [
      { label: "Active partnerships", value: records.filter((item) => item.status === "active").length, tone: "green" },
      { label: "Requests under review", value: records.filter((item) => item.status !== "active").length, tone: "blue" },
      { label: "Required actions", value: openCorrections.length, tone: "orange" },
      { label: "Documents due", value: openCorrections.filter((item) => item.category === "Missing Document").length, tone: "orange" }
    ]
  };

  const byStageMap = records.reduce((acc, item) => {
    acc[item.stage] = (acc[item.stage] || 0) + 1;
    return acc;
  }, {});

  return {
    kpis: roleKpis[user.role] || [],
    agreements: records.slice(0, 6),
    corrections: openCorrections.slice(0, 5),
    notifications: state.notifications.filter((item) => item.user_id === user.id || item.role === user.role).slice(0, 5),
    totals: dashboardTotals,
    by_stage: Object.entries(byStageMap).map(([key, value]) => ({ name: stageLabel(key), key, value })),
    by_type: [
      { name: "MoU", value: 45 },
      { name: "MoA", value: 30 },
      { name: "CRA", value: 15 },
      { name: "CA", value: 10 }
    ],
    trend: [
      { month: "Mar", requests: 12 },
      { month: "Apr", requests: 16 },
      { month: "May", requests: 19 },
      { month: "Jun", requests: 17 },
      { month: "Jul", requests: 24 },
      { month: "Aug", requests: 28 }
    ]
  };
}

function csvFromAgreements(records) {
  const header = ["Reference", "Title", "Partner", "Type", "Faculty", "Department", "Stage", "Status", "Risk", "Updated"];
  const rows = records.map((item) => [item.reference, item.title, item.partner_name, item.agreement_type, item.faculty, item.department, stageLabel(item.stage), statusLabel(item.status), item.risk, item.updated_at]);
  return [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}

function routeMatch(path, pattern) {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

export async function mockRequest(pathWithQuery, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const url = new URL(pathWithQuery, "http://mock.local");
  const path = url.pathname;
  const method = (options.method || "GET").toUpperCase();
  const state = loadState();
  const body = await parseBody(options);

  if (path === "/auth/login" && method === "POST") {
    const user = state.users.find((item) => item.email.toLowerCase() === String(body.email || "").toLowerCase());
    if (!user || user.password !== body.password || !user.is_active) return error("Invalid email or password.", 401);
    const safeUser = { ...user };
    delete safeUser.password;
    return json({ access_token: `${TOKEN_PREFIX}${user.id}`, token_type: "bearer", user: safeUser });
  }

  if (path === "/auth/forgot-password" && method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return error("Email address is required.", 422);
    const matchedUser = state.users.find((item) => item.email.toLowerCase() === email);
    addAudit(state, matchedUser || null, "requested_password_reset", "Account", email, "Password reset requested.");
    saveState(state);
    return json({ message: "If an active account exists for that email, a reset link has been queued." });
  }

  if (path === "/auth/register-partner" && method === "POST") {
    const reference = `PAR-${new Date().getFullYear()}-${String(state.partnerApplications.length + 1).padStart(4, "0")}`;
    const application = { id: makeId("application"), reference, status: "pending_review", submitted_at: new Date().toISOString(), ...body };
    state.partnerApplications.push(application);
    addAudit(state, null, "submitted_partner_registration", "Partner Application", reference, `Registration submitted for ${body.institution_name || "partner institution"}.`);
    saveState(state);
    return json(application, 201);
  }

  if (path.startsWith("/auth/registration/") && method === "GET") {
    const reference = decodeURIComponent(path.split("/").pop());
    const application = state.partnerApplications.find((item) => item.reference === reference);
    return application ? json(application) : error("Registration application not found.", 404);
  }

  const user = requestUser(state, options);
  if (!user) return error("Authentication required.", 401);
  const safeUser = { ...user };
  delete safeUser.password;

  if (path === "/auth/me" && method === "GET") return json(safeUser);
  if (path === "/dashboard" && method === "GET") return json(dashboardFor(state, user));
  if (path === "/reference-data" && method === "GET") return json({
    agreement_types: state.configuration.agreement_types.filter((item) => item.status === "active"),
    institution_types: state.configuration.institution_types,
    countries: state.configuration.countries,
    faculties: state.configuration.faculties,
    departments: state.configuration.departments,
    required_document_rules: state.configuration.required_document_rules
  });

  if (path === "/directory/champions" && method === "GET") {
    const champions = state.users
      .filter((item) => item.is_active && ["researcher", "me", "linkages", "director_linkages"].includes(item.role))
      .map(({ password, ...safe }) => ({ ...safe, eligible_as_champion: true }));
    return json(champions);
  }

  if (path === "/agreements" && method === "GET") {
    let records = scopedAgreements(state, user);
    const search = (url.searchParams.get("search") || "").toLowerCase();
    const stage = url.searchParams.get("stage");
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const risk = url.searchParams.get("risk");
    if (search) records = records.filter((item) => [item.reference, item.title, item.partner_name].some((value) => String(value).toLowerCase().includes(search)));
    if (stage) records = records.filter((item) => item.stage === stage);
    if (status) records = records.filter((item) => item.status === status);
    if (type) records = records.filter((item) => item.agreement_type === type);
    if (risk) records = records.filter((item) => item.risk === risk);
    return json(records);
  }

  if (path === "/agreements" && method === "POST") {
    if (!["researcher", "linkages", "director_linkages"].includes(user.role)) return error("You are not permitted to create an agreement.", 403);
    const partner = state.partners.find((item) => item.id === body.partner_id);
    if (!partner) return error("Select a valid partner.", 422);
    const nextNumber = String(120 + state.agreements.length).padStart(4, "0");
    const agreement = {
      id: makeId("agr"),
      reference: `JKUAT/ACC/${new Date().getFullYear()}/${nextNumber}`,
      title: body.title,
      partner_id: partner.id,
      partner_name: partner.name,
      agreement_type: body.agreement_type,
      faculty: body.faculty,
      department: body.department,
      initiator_id: user.id,
      initiator_name: user.full_name,
      champion_id: body.champion_id || null,
      champion_name: state.users.find((item) => item.id === body.champion_id)?.full_name || null,
      assigned_reviewer_id: null,
      stage: "draft_documents",
      status: body.submit ? "pending" : "draft",
      days_in_stage: 0,
      risk: body.risk || "low",
      intended_start_date: body.intended_start_date,
      proposed_duration_months: Number(body.proposed_duration_months || 12),
      effective_date: null,
      expiry_date: null,
      purpose: body.purpose,
      collaboration_area: body.collaboration_area,
      strategic_alignment: body.strategic_alignment,
      expected_outcomes: Array.isArray(body.expected_outcomes) ? body.expected_outcomes : String(body.expected_outcomes || "").split("\n").filter(Boolean),
      current_action: body.submit ? "Faculty academic-fit review" : "Complete draft and required documents",
      next_office: body.submit ? "Faculty Approver" : "Researcher / Champion",
      template: state.templates.find((item) => item.id === body.template_id) ? { ...state.templates.find((item) => item.id === body.template_id), title: state.templates.find((item) => item.id === body.template_id).name, compliance: 100, locked: false } : null,
      documents: body.documents || [],
      partner_liaison_name: null,
      initial_deliverables: [],
      corrections: [],
      legal_comments: [],
      lifecycle_history: [
        { stage: "partner_inquiry", status: "completed", completed_at: new Date().toISOString().slice(0, 10), responsible: "Researcher" },
        { stage: "partner_verification", status: "completed", completed_at: new Date().toISOString().slice(0, 10), responsible: "Linkages Directorate" },
        ...(body.champion_id ? [{ stage: "champion_assignment", status: "completed", completed_at: new Date().toISOString().slice(0, 10), responsible: "Linkages Directorate" }] : []),
        { stage: "agreement_details", status: "completed", completed_at: new Date().toISOString().slice(0, 10), responsible: "Researcher / Champion" },
        { stage: "draft_documents", status: body.submit ? "completed" : "active", ...(body.submit ? { completed_at: new Date().toISOString().slice(0, 10) } : { started_at: new Date().toISOString().slice(0, 10) }), responsible: "Researcher / Champion" },
        ...(body.submit ? [{ stage: "faculty_review", status: "active", started_at: new Date().toISOString().slice(0, 10), responsible: "Faculty Approver" }] : [])
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (body.submit) agreement.stage = "faculty_review";
    state.agreements.unshift(agreement);
    addAudit(state, user, body.submit ? "submitted_agreement" : "created_agreement_draft", "Agreement", agreement.reference, agreement.title);
    saveState(state);
    return json(agreement, 201);
  }

  let params = routeMatch(path, "/agreements/:id");
  if (params && method === "GET") {
    const record = scopedAgreements(state, user).find((item) => item.id === params.id);
    return record ? json(record) : error("Agreement not found or outside your permitted scope.", 404);
  }

  params = routeMatch(path, "/agreements/:id");
  if (params && method === "PATCH") {
    const index = state.agreements.findIndex((item) => item.id === params.id);
    if (index < 0) return error("Agreement not found.", 404);
    if (!["researcher", "linkages", "director_linkages"].includes(user.role)) return error("You are not permitted to edit this agreement.", 403);
    state.agreements[index] = { ...state.agreements[index], ...body, updated_at: new Date().toISOString() };
    addAudit(state, user, "updated_agreement", "Agreement", state.agreements[index].reference, "Agreement details updated.");
    saveState(state);
    return json(state.agreements[index]);
  }

  params = routeMatch(path, "/agreements/:id/actions/:action");
  if (params && method === "POST") {
    const index = state.agreements.findIndex((item) => item.id === params.id);
    if (index < 0) return error("Agreement not found.", 404);
    const current = state.agreements[index];
    const availableActions = getAvailableActions(current, user.role).map((item) => item.key);
    if (!availableActions.includes(params.action)) return error("This action is not available for your role or the current stage.", 403);
    if (["return_correction", "request_amendment", "reject", "close", "archive"].includes(params.action) && !String(body.reason || "").trim()) return error("A mandatory reason is required.", 422);
    if (["return_correction", "request_amendment"].includes(params.action) && (!String(body.exact_item || "").trim() || !String(body.requested_change || "").trim())) return error("The exact affected item and requested change are required.", 422);
    if (params.action === "upload_signed" && !body.document?.name) return error("The fully signed PDF is required.", 422);
    if (params.action === "activate") {
      const gates = [
        current.template?.locked,
        current.lifecycle_history?.some((item) => item.stage === "dvc_endorsement" && item.status === "completed"),
        current.lifecycle_history?.some((item) => item.stage === "vc_submission" && item.status === "completed"),
        current.signing?.vc_signed,
        current.signing?.partner_signed,
        current.signing?.fully_signed_uploaded || current.documents?.some((item) => item.status === "final_signed"),
        current.champion_id,
        body.partner_liaison_name,
        body.initial_deliverable,
        body.effective_date,
        body.expiry_date
      ];
      if (gates.some((value) => !value)) return error("All signing and activation checklist items must be complete.", 422);
      if (new Date(body.expiry_date) <= new Date(body.effective_date)) return error("Expiry date must be later than the effective date.", 422);
    }
    const updated = applyWorkflowAction(current, params.action, body);
    state.agreements[index] = updated;
    if (params.action === "upload_signed" && body.document) {
      updated.documents = [...(updated.documents || []), {
        id: makeId("doc"),
        name: body.document.name,
        type: "Final signed agreement",
        version: "1.0",
        status: "final_signed",
        confidentiality: "restricted",
        uploaded_by: user.full_name,
        uploaded_at: new Date().toISOString(),
        size: body.document.size,
        mime_type: body.document.mime_type || "application/pdf"
      }];
    }
    addAudit(state, user, params.action, "Agreement", current.reference, body.reason || `Workflow action: ${params.action}`, ["reject", "return_correction", "request_amendment"].includes(params.action) ? "warning" : "info");
    const notificationRole = {
      approve_faculty: "linkages", approve_linkages: "legal", approve_legal: "dvc",
      endorse_dvc: "vc_office", release_vc: "vc_office", record_vc_signature: "partner",
      record_partner_signature: "vc_office", upload_signed: "linkages", activate: "me",
      return_correction: body.requested_from_role || "researcher", request_amendment: "linkages"
    }[params.action];
    if (notificationRole) addNotification(state, {
      role: notificationRole,
      title: `${stageLabel(updated.stage)} action required`,
      reference: current.reference,
      action: updated.current_action,
      link: `/agreements/${current.id}`,
      priority: ["return_correction", "request_amendment"].includes(params.action) ? "high" : "normal",
      dueDate: body.due_date,
      sender: user.full_name
    });
    if (["return_correction", "request_amendment"].includes(params.action)) {
      const correction = {
        id: makeId("cor"),
        code: `COR-${new Date().getFullYear()}-${String(state.corrections.length + 25).padStart(3, "0")}`,
        agreement_id: current.id,
        agreement_reference: current.reference,
        agreement_title: current.title,
        requested_by_id: user.id,
        requested_by: user.full_name,
        requested_from_role: body.requested_from_role || "researcher",
        requested_from_id: body.requested_from_id || current.initiator_id,
        category: body.category || "General correction",
        exact_item: body.exact_item || "Agreement record",
        deep_link: `/agreements/${current.id}`,
        previous_value: body.previous_value || "See current agreement version",
        requested_change: body.requested_change || body.reason,
        reason: body.reason,
        due_date: body.due_date,
        status: "open",
        notification_status: "queued",
        response: "",
        replacement_document: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null
      };
      state.corrections.unshift(correction);
      updated.corrections = [...(updated.corrections || []), correction.id];
    }
    saveState(state);
    return json(updated);
  }

  params = routeMatch(path, "/agreements/:id/legal-comments");
  if (params && method === "POST") {
    if (user.role !== "legal") return error("Only Legal reviewers may add Legal comments.", 403);
    const index = state.agreements.findIndex((item) => item.id === params.id);
    if (index < 0 || !scopedAgreements(state, user).some((item) => item.id === params.id)) return error("Agreement not found or outside your permitted scope.", 404);
    if (!String(body.clause || "").trim() || !String(body.text || "").trim()) return error("Exact clause/section and Legal comment are required.", 422);
    const comment = { id: makeId("legal-comment"), clause: body.clause, text: body.text, status: "open", blocking: Boolean(body.blocking), author: user.full_name, created_at: new Date().toISOString() };
    state.agreements[index].legal_comments = [...(state.agreements[index].legal_comments || []), comment];
    addAudit(state, user, "added_legal_comment", "Agreement", state.agreements[index].reference, `${body.clause}: ${body.text}`, body.blocking ? "warning" : "info");
    saveState(state);
    return json(comment, 201);
  }

  params = routeMatch(path, "/agreements/:id/legal-comments/:commentId/resolve");
  if (params && method === "POST") {
    if (user.role !== "legal") return error("Only Legal reviewers may resolve Legal comments.", 403);
    const index = state.agreements.findIndex((item) => item.id === params.id);
    if (index < 0 || !scopedAgreements(state, user).some((item) => item.id === params.id)) return error("Agreement not found or outside your permitted scope.", 404);
    const comment = state.agreements[index].legal_comments?.find((item) => item.id === params.commentId);
    if (!comment) return error("Legal comment not found.", 404);
    comment.status = "resolved";
    comment.resolved_at = new Date().toISOString();
    comment.resolved_by = user.full_name;
    addAudit(state, user, "resolved_legal_comment", "Agreement", state.agreements[index].reference, comment.clause);
    saveState(state);
    return json(comment);
  }

  params = routeMatch(path, "/agreements/:id/documents");
  if (params && method === "POST") {
    if (!["researcher", "approver", "linkages", "director_linkages", "legal", "vc_office", "me"].includes(user.role)) return error("You are not permitted to upload agreement documents.", 403);
    const agreement = state.agreements.find((item) => item.id === params.id);
    if (!agreement || !scopedAgreements(state, user).some((item) => item.id === agreement.id)) return error("Agreement not found or outside your permitted scope.", 404);
    if (!body.name) return error("Document name is required.", 422);
    const document = {
      id: makeId("doc"), name: body.name, type: body.type || "Supporting document", version: body.version || "1.0",
      status: body.type === "Legal-approved draft" ? "approved" : body.type === "Final signed agreement" ? "final_signed" : "uploaded",
      confidentiality: body.confidentiality || "internal", description: body.description || "", uploaded_by: user.full_name,
      uploaded_at: new Date().toISOString(), size: body.size || null, mime_type: body.mime_type || null
    };
    agreement.documents = [...(agreement.documents || []), document];
    agreement.updated_at = new Date().toISOString();
    addAudit(state, user, "uploaded_document", "Agreement", agreement.reference, document.name);
    saveState(state);
    return json(document, 201);
  }

  params = routeMatch(path, "/agreements/:id/documents/:documentId/download");
  if (params && method === "GET") {
    const agreement = scopedAgreements(state, user).find((item) => item.id === params.id);
    const document = agreement?.documents?.find((item) => item.id === params.documentId);
    if (!document) return error("Document not found or outside your permitted scope.", 404);
    if (user.role === "partner" && !["public", "partner_shared"].includes(document.confidentiality)) return error("This document is not shared with the partner.", 403);
    return text(`Accord360 demonstration document placeholder for ${document.name}. Production must return the securely stored file.`, 200, {
      "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${document.name.replaceAll('"', '')}"`
    });
  }

  if (path === "/partners" && method === "GET") {
    let records = state.partners;
    if (user.role === "partner") records = records.filter((item) => item.id === user.partner_id);
    const search = (url.searchParams.get("search") || "").toLowerCase();
    const status = url.searchParams.get("status");
    if (search) records = records.filter((item) => [item.name, item.country, item.sector].some((value) => String(value).toLowerCase().includes(search)));
    if (status) records = records.filter((item) => item.verification_status === status);
    return json(records);
  }

  params = routeMatch(path, "/partners/:id");
  if (params && method === "GET") {
    const record = state.partners.find((item) => item.id === params.id);
    if (!record) return error("Partner not found.", 404);
    if (user.role === "partner" && user.partner_id !== record.id) return error("Partner record outside your permitted scope.", 403);
    return json({ ...record, agreements: state.agreements.filter((item) => item.partner_id === record.id) });
  }

  params = routeMatch(path, "/partners/:id");
  if (params && method === "PATCH") {
    const record = state.partners.find((item) => item.id === params.id);
    if (!record) return error("Partner not found.", 404);
    const allowed = ["linkages", "director_linkages", "admin"].includes(user.role) || (user.role === "partner" && user.partner_id === record.id);
    if (!allowed) return error("You are not permitted to update this partner profile.", 403);
    const editable = user.role === "partner" ? ["contact_name", "contact_email", "contact_phone"] : Object.keys(body);
    for (const key of editable) if (Object.hasOwn(body, key)) record[key] = body[key];
    record.updated_at = new Date().toISOString();
    addAudit(state, user, "updated_partner_profile", "Partner", record.name, "Partner profile details updated.");
    saveState(state);
    return json(record);
  }

  params = routeMatch(path, "/partners/:id/verify");
  if (params && method === "POST") {
    if (!["linkages", "director_linkages"].includes(user.role)) return error("Only Linkages may verify partner institutions.", 403);
    const record = state.partners.find((item) => item.id === params.id);
    if (!record) return error("Partner not found.", 404);
    if (!["approve", "reject", "request_info"].includes(body.decision)) return error("Select a valid verification decision.", 422);
    if (!String(body.reason || "").trim()) return error("A mandatory verification reason is required.", 422);
    if (body.decision === "approve" && !body.champion_id) return error("Assign a JKUAT Champion before verifying the institution.", 422);
    record.verification_status = body.decision === "approve" ? "verified" : body.decision === "reject" ? "rejected" : "additional_information_required";
    record.verification_reason = body.reason;
    record.verified_by = user.full_name;
    record.verified_at = new Date().toISOString();
    if (body.champion_id) {
      const champion = state.users.find((item) => item.id === body.champion_id);
      record.champion_id = champion?.id || null;
      record.champion_name = champion?.full_name || null;
    }
    addAudit(state, user, "partner_verification_decision", "Partner", record.name, `${body.decision}: ${body.reason}`, body.decision === "reject" ? "warning" : "info");
    saveState(state);
    return json(record);
  }

  if (path === "/corrections" && method === "GET") return json(scopedCorrections(state, user));

  params = routeMatch(path, "/corrections/:id");
  if (params && method === "GET") {
    const record = scopedCorrections(state, user).find((item) => item.id === params.id);
    return record ? json(record) : error("Correction not found or outside your permitted scope.", 404);
  }

  params = routeMatch(path, "/corrections/:id/respond");
  if (params && method === "POST") {
    const record = state.corrections.find((item) => item.id === params.id);
    if (!record) return error("Correction not found.", 404);
    const agreement = state.agreements.find((item) => item.id === record.agreement_id);
    const permitted = record.requested_from_id === user.id
      || record.requested_from_role === user.role
      || (user.role === "partner" && agreement?.partner_id === user.partner_id)
      || (user.role === "researcher" && [agreement?.initiator_id, agreement?.champion_id].includes(user.id));
    if (!permitted) return error("This correction is not assigned to you.", 403);
    if (!String(body.response || "").trim()) return error("A correction response is required.", 422);
    record.response = body.response;
    record.replacement_document = body.replacement_document || null;
    record.status = "submitted";
    record.responded_at = new Date().toISOString();
    record.responded_by = user.full_name;
    addAudit(state, user, "submitted_correction_response", "Correction", record.code, body.response);
    saveState(state);
    return json(record);
  }

  params = routeMatch(path, "/corrections/:id/resolve");
  if (params && method === "POST") {
    if (!["linkages", "director_linkages", "legal", "approver"].includes(user.role)) return error("You are not permitted to resolve this correction.", 403);
    const record = state.corrections.find((item) => item.id === params.id);
    if (!record) return error("Correction not found.", 404);
    record.status = "resolved";
    record.resolved_at = new Date().toISOString();
    record.resolved_by = user.full_name;
    addAudit(state, user, "resolved_correction", "Correction", record.code, body.note || "Correction accepted.");
    saveState(state);
    return json(record);
  }

  if (path === "/notifications" && method === "GET") {
    return json(state.notifications.filter((item) => item.user_id === user.id || item.role === user.role));
  }

  params = routeMatch(path, "/notifications/:id/read");
  if (params && method === "POST") {
    const record = state.notifications.find((item) => item.id === params.id && (item.user_id === user.id || item.role === user.role));
    if (!record) return error("Notification not found.", 404);
    record.is_read = true;
    saveState(state);
    return json(record);
  }

  params = routeMatch(path, "/notifications/:id/resend");
  if (params && method === "POST") {
    const record = state.notifications.find((item) => item.id === params.id && (item.user_id === user.id || item.role === user.role || ["linkages", "director_linkages", "admin"].includes(user.role)));
    if (!record) return error("Notification not found.", 404);
    record.email_status = "queued";
    record.reminder_history = [...(record.reminder_history || []), { action: "resend_queued", by: user.full_name, at: new Date().toISOString() }];
    addAudit(state, user, "resent_notification_email", "Notification", record.record_reference, record.title);
    saveState(state);
    return json(record);
  }

  if (path === "/me/reports" && method === "GET") {
    return json(scopedMeReports(state, user));
  }

  params = routeMatch(path, "/me/reports/:id");
  if (params && method === "GET") {
    const record = scopedMeReports(state, user).find((item) => item.id === params.id);
    return record ? json(record) : error("M&E report not found or outside your permitted scope.", 404);
  }

  params = routeMatch(path, "/me/reports/:id");
  if (params && method === "PATCH") {
    if (!["researcher", "me", "linkages", "director_linkages"].includes(user.role)) return error("You are not permitted to update M&E reports.", 403);
    const record = state.meReports.find((item) => item.id === params.id);
    if (!record) return error("M&E report not found.", 404);
    const isChampion = record.champion_id === user.id;
    const requestedStatus = body.status || record.status;
    if (["draft", "submitted"].includes(requestedStatus) && !isChampion && user.role !== "me") return error("Only the assigned Champion or M&E Officer may edit and submit this report.", 403);
    if (["validated", "returned"].includes(requestedStatus) && !["me", "linkages", "director_linkages"].includes(user.role)) return error("Only Linkages or M&E reviewers may validate or return this report.", 403);
    if (requestedStatus === "returned" && !String(body.review_note || "").trim()) return error("A return reason is required.", 422);
    Object.assign(record, body, { updated_at: new Date().toISOString() });
    const details = requestedStatus === "submitted" ? "Submitted report to Linkages."
      : requestedStatus === "validated" ? "Validated six-month report."
        : requestedStatus === "returned" ? `Returned report for correction: ${body.review_note}`
          : "Saved report draft.";
    addAudit(state, user, `me_report_${requestedStatus}`, "M&E Report", record.agreement_reference, details, requestedStatus === "returned" ? "warning" : "info");
    if (requestedStatus === "submitted") addNotification(state, { role: "linkages", title: "Six-month report awaiting validation", reference: record.agreement_reference, action: "Review and validate the Champion report.", link: `/monitoring/reports/${record.id}`, sender: user.full_name });
    if (requestedStatus === "returned") addNotification(state, { userId: record.champion_id, title: "Six-month report returned for correction", reference: record.agreement_reference, action: body.review_note, link: `/monitoring/reports/${record.id}`, priority: "high", sender: user.full_name });
    if (requestedStatus === "validated") addNotification(state, { userId: record.champion_id, title: "Six-month report validated", reference: record.agreement_reference, action: "No further action is required for this reporting period.", link: `/monitoring/reports/${record.id}`, sender: user.full_name });
    saveState(state);
    return json(record);
  }

  if (path === "/scorecards" && method === "GET") {
    if (!["me", "linkages", "director_linkages", "executive"].includes(user.role)) return error("You are not permitted to view scorecards.", 403);
    return json(state.scorecards);
  }

  params = routeMatch(path, "/scorecards/:id/recalculate");
  if (params && method === "POST") {
    if (!["me", "linkages", "director_linkages"].includes(user.role)) return error("You are not permitted to recalculate partnership scores.", 403);
    const record = state.scorecards.find((item) => item.id === params.id);
    if (!record) return error("Scorecard not found.", 404);
    const totalWeight = record.components.reduce((sum, item) => sum + Number(item.weight), 0);
    if (totalWeight !== 100) return error("Active score weights must total 100%.", 422);
    record.overall_score = Math.round(record.components.reduce((sum, item) => sum + Number(item.score) * Number(item.weight) / 100, 0));
    record.calculation_date = new Date().toISOString().slice(0, 10);
    record.reviewer = user.full_name;
    addAudit(state, user, "recalculated_scorecard", "Scorecard", record.agreement_reference, `Overall score: ${record.overall_score}`);
    saveState(state);
    return json(record);
  }

  if (path === "/reports/portfolio" && method === "GET") {
    if (!["linkages", "director_linkages", "dvc", "executive", "me", "auditor", "admin"].includes(user.role)) return error("You are not permitted to view reports.", 403);
    return json({
      totals: dashboardTotals,
      by_type: [
        { name: "MoU", value: 45 },
        { name: "MoA", value: 30 },
        { name: "CRA", value: 15 },
        { name: "CA", value: 10 }
      ],
      by_faculty: [
        { name: "Engineering", value: 45 },
        { name: "Science", value: 38 },
        { name: "Agriculture", value: 32 },
        { name: "Health Sciences", value: 25 }
      ],
      countries: [
        { name: "Kenya", value: 63 },
        { name: "Uganda", value: 21 },
        { name: "Tanzania", value: 17 },
        { name: "Finland", value: 12 }
      ],
      trend: [
        { month: "Mar", requests: 12 },
        { month: "Apr", requests: 16 },
        { month: "May", requests: 19 },
        { month: "Jun", requests: 17 },
        { month: "Jul", requests: 24 },
        { month: "Aug", requests: 28 }
      ]
    });
  }

  if (path === "/reports/ai-summary" && method === "POST") {
    if (!["linkages", "director_linkages", "dvc", "executive", "me", "admin"].includes(user.role)) return error("You are not permitted to generate AI-assisted reports.", 403);
    const report = {
      id: makeId("ai-report"),
      status: "draft_pending_human_approval",
      generated_at: new Date().toISOString(),
      filters: body,
      label: "AI-generated draft",
      narrative: "The selected Accord360 portfolio shows stable partnership activity with active agreements concentrated in research and academic exchange programmes. The principal operational risks are delayed Legal review, overdue six-month reporting and a small group of dormant partnerships. Management attention should focus on unresolved corrections, agreements awaiting DVC RPE endorsement and records approaching expiry.",
      findings: [
        { title: "Approval time exceeds target", value: "16 days", support: ["Portfolio metric: average approval time"], action: "Review stage-level SLA bottlenecks." },
        { title: "M&E completion below baseline", value: "76%", support: ["Six-month reporting dashboard"], action: "Escalate overdue Champion reports." },
        { title: "Expiry exposure", value: "8 agreements", support: ["Expiry report: next 90 days"], action: "Start renewal decisions early." }
      ],
      disclaimer: "This summary was generated from the selected system records. All figures and conclusions must be reviewed before approval."
    };
    state.reportDrafts.push(report);
    saveState(state);
    return json(report);
  }

  params = routeMatch(path, "/reports/ai-summary/:id/approve");
  if (params && method === "POST") {
    if (!["linkages", "director_linkages", "dvc", "executive"].includes(user.role)) return error("You are not permitted to approve this report.", 403);
    const report = state.reportDrafts.find((item) => item.id === params.id);
    if (!report) return error("AI report draft not found.", 404);
    report.narrative = body.narrative || report.narrative;
    report.status = "approved";
    report.approved_by = user.full_name;
    report.approved_at = new Date().toISOString();
    addAudit(state, user, "approved_ai_report", "Report", report.id, "Human reviewer approved the AI-assisted narrative.");
    saveState(state);
    return json(report);
  }

  if (path === "/reports/agreements.csv" && method === "GET") {
    return text(csvFromAgreements(scopedAgreements(state, user)), 200, { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="accord360-agreements.csv"' });
  }

  if (path === "/reports/export.pdf" && method === "GET") {
    const payload = [
      "ACCORD360 DEMONSTRATION REPORT",
      "Backend integration will replace this placeholder with a generated PDF.",
      `Generated: ${new Date().toISOString()}`,
      `Records in scope: ${scopedAgreements(state, user).length}`
    ].join("\n");
    return text(payload, 200, { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="accord360-report.pdf"' });
  }

  if (path === "/reports/export.xlsx" && method === "GET") {
    return text(csvFromAgreements(scopedAgreements(state, user)), 200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="accord360-report.xlsx"' });
  }

  if (path === "/users" && method === "GET") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    return json(state.users.map(({ password, ...safe }) => safe));
  }

  if (path === "/users" && method === "POST") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    if (state.users.some((item) => item.email.toLowerCase() === String(body.email).toLowerCase())) return error("A user with this email already exists.", 409);
    const record = { id: makeId("usr"), full_name: body.full_name, email: body.email, password: body.password, role: body.role, department: body.department || "", faculty: body.faculty || "", is_active: true, created_at: new Date().toISOString() };
    state.users.push(record);
    addAudit(state, user, "created_user", "User", record.email, `Assigned role ${record.role}.`);
    saveState(state);
    const { password, ...safe } = record;
    return json(safe, 201);
  }

  params = routeMatch(path, "/users/:id");
  if (params && method === "PATCH") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    const record = state.users.find((item) => item.id === params.id);
    if (!record) return error("User not found.", 404);
    Object.assign(record, body);
    addAudit(state, user, "updated_user", "User", record.email, "User access details updated.");
    saveState(state);
    const { password, ...safe } = record;
    return json(safe);
  }

  if (path === "/configuration" && method === "GET") return json(state.configuration);
  if (path === "/configuration" && method === "PATCH") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    const next = { ...state.configuration, ...body };
    const totalWeight = (next.scoring_weights || []).reduce((sum, item) => sum + Number(item.weight), 0);
    if (totalWeight !== 100) return error("Scoring weights must total exactly 100%.", 422);
    state.configuration = next;
    addAudit(state, user, "updated_configuration", "Configuration", "SYSTEM", "System configuration updated.");
    saveState(state);
    return json(next);
  }

  if (path === "/templates" && method === "GET") return json(state.templates);
  if (path === "/templates" && method === "POST") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    if (!body.name || !body.agreement_type || !body.version) return error("Template name, agreement type and version are required.", 422);
    const record = { id: makeId("tpl"), status: "draft", owner: user.full_name, effective_date: null, description: "", ...body };
    state.templates.push(record);
    addAudit(state, user, "created_template_version", "Template", record.id, `${record.name} v${record.version}`);
    saveState(state);
    return json(record, 201);
  }
  params = routeMatch(path, "/templates/:id");
  if (params && method === "PATCH") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    const record = state.templates.find((item) => item.id === params.id);
    if (!record) return error("Template not found.", 404);
    Object.assign(record, body);
    addAudit(state, user, "updated_template", "Template", record.id, `${record.name} v${record.version}`);
    saveState(state);
    return json(record);
  }
  if (path === "/audit" && method === "GET") {
    if (!["admin", "auditor", "executive", "director_linkages"].includes(user.role)) return error("Audit access is not available for your role.", 403);
    return json(state.auditEvents);
  }

  if (path === "/mock/reset" && method === "POST") {
    if (user.role !== "admin") return error("Administrator access required.", 403);
    const reset = initialState();
    saveState(reset);
    return json({ message: "Demonstration data reset." });
  }

  return error(`Mock endpoint not implemented: ${method} ${path}`, 404);
}
