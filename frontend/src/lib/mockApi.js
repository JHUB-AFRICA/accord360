const STORAGE_KEY = "accord360_contract_mock_v1";
const TOKEN_PREFIX = "mock-token-";

const credentials = {
  "researcher@accord360.app": "Research@123",
  "approver@accord360.app": "Approver@123",
  "linkages@accord360.app": "Linkages@123",
  "director.linkages@accord360.app": "Director@123",
  "legal@accord360.app": "Legal@123",
  "dvc.rpe@accord360.app": "DvcRpe@123",
  "vc.office@accord360.app": "VcOffice@123",
  "me@accord360.app": "Measure@123",
  "executive@accord360.app": "Executive@123",
  "admin@accord360.app": "Admin@123",
  "auditor@accord360.app": "Auditor@123"
};

const roleUsers = [
  [1, "Dr. Peter Mwangi", "researcher@accord360.app", "researcher", "Public Health"],
  [2, "Prof. Daniel Kimani", "approver@accord360.app", "approver", "Agricultural Engineering"],
  [3, "Jane Muthoni", "linkages@accord360.app", "linkages", "Directorate of Linkages (RPE)"],
  [4, "Dr. Samuel Kariuki", "director.linkages@accord360.app", "director_linkages", "Directorate of Linkages (RPE)"],
  [5, "Counsel Angela Wanjiku", "legal@accord360.app", "legal", "University Legal Office"],
  [6, "Prof. Grace Nyambura", "dvc.rpe@accord360.app", "dvc", "DVC RPE"],
  [7, "Michael Otieno", "vc.office@accord360.app", "vc_office", "Vice Chancellor's Office"],
  [8, "Prof. Alice Njeri", "me@accord360.app", "me", "Monitoring & Evaluation"],
  [9, "Prof. John K. Chemutai", "executive@accord360.app", "executive", "University Executive"],
  [10, "Esther Kamau", "admin@accord360.app", "admin", "ICT Directorate"],
  [11, "Charles Kiprop", "auditor@accord360.app", "auditor", "Internal Audit"]
];

const now = () => new Date().toISOString();
const clone = (value) => structuredClone(value);

function user(id, name, email, role, department) {
  return { id, full_name: name, email, role, department, is_active: true, created_at: "2026-01-10T08:00:00Z" };
}

function initialState() {
  const users = roleUsers.map((row) => user(...row));
  const partners = [
    { id: 1, name: "East Africa Institute of Technology", sector: "Higher Education", partner_type: "University", country: "Kenya", contact_name: "Anne Achieng", contact_email: "anne@eait.example", legal_counterpart: "Office of Legal Affairs", liaison: "Anne Achieng", status: "active", created_at: "2026-01-12T09:00:00Z" },
    { id: 2, name: "GreenFields Manufacturing Ltd", sector: "Manufacturing", partner_type: "Private Sector", country: "Kenya", contact_name: "David Mutua", contact_email: "david@greenfields.example", legal_counterpart: "Company Secretary", liaison: "David Mutua", status: "under_review", created_at: "2026-02-02T09:00:00Z" },
    { id: 3, name: "Regional Health Research Centre", sector: "Health Research", partner_type: "Government Research Institution", country: "Uganda", contact_name: "Dr. Sarah Namusoke", contact_email: "sarah@rhrc.example", legal_counterpart: "Research Compliance Office", liaison: "Dr. Sarah Namusoke", status: "active", created_at: "2026-02-18T09:00:00Z" },
    { id: 4, name: "Sustainable Futures Foundation", sector: "Climate and Development", partner_type: "NGO", country: "Tanzania", contact_name: "Neema Mushi", contact_email: "neema@sff.example", legal_counterpart: "Governance Office", liaison: "Neema Mushi", status: "additional_information_required", created_at: "2026-03-04T09:00:00Z" },
    { id: 5, name: "Nordic Digital Innovation University", sector: "Technology and Innovation", partner_type: "University", country: "Finland", contact_name: "Liisa Korhonen", contact_email: "liisa@ndiu.example", legal_counterpart: "University Legal Services", liaison: "Liisa Korhonen", status: "active", created_at: "2025-11-04T09:00:00Z" }
  ];

  const makeAgreement = (id, overrides) => ({
    id,
    reference_number: `JKUAT-MOU-2026-${String(id).padStart(4, "0")}`,
    title: "Institutional Collaboration",
    agreement_type: "MoU",
    purpose: "A sufficiently detailed collaboration purpose for frontend integration testing.",
    expected_outcomes: "Joint research outputs; Student and staff development",
    strategic_alignment: "JKUAT research, innovation and partnership objectives",
    department: "Agricultural Engineering",
    stage: "initiation",
    status: "draft",
    status_color: "green",
    next_action: "Complete the request and submit for departmental approval",
    partner: partners[0],
    owner: users[0],
    confidentiality: "internal",
    internal_champion: users[0].full_name,
    partner_liaison: partners[0].liaison,
    effective_date: null,
    expiry_date: null,
    signing_date: null,
    date_sent_vc: null,
    date_sent_partner: null,
    legal_review_days: null,
    days_to_expiry: null,
    documents: [],
    workflow_events: [{ id: id * 10, from_stage: null, to_stage: "initiation", action: "create", comment: "Collaboration request created", created_at: "2026-01-10T08:00:00Z", actor: users[0] }],
    deliverables: [],
    values: [],
    created_at: "2026-01-10T08:00:00Z",
    updated_at: "2026-08-05T08:00:00Z",
    ...overrides
  });

  const agreements = [
    makeAgreement(1, { reference_number: "JKUAT-CRA-2026-0001", title: "Digital Agriculture Research Collaboration", agreement_type: "CRA", stage: "legal_review", status: "in_legal_review", status_color: "green", next_action: "Legal Office review in progress", legal_review_days: 4, documents: [{ id: 1, agreement_id: 1, document_type: "supporting", version: "1.2", original_name: "Working_Draft_v1.2.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 32000, is_official: false, confidentiality: "internal", created_at: "2026-07-28T08:00:00Z" }], workflow_events: [
      { id: 10, from_stage: null, to_stage: "initiation", action: "create", comment: "Request created", created_at: "2026-01-10T08:00:00Z", actor: users[0] },
      { id: 11, from_stage: "initiation", to_stage: "department_approval", action: "submit", comment: "Submitted", created_at: "2026-01-12T08:00:00Z", actor: users[0] },
      { id: 12, from_stage: "department_approval", to_stage: "linkages_review", action: "approve_department", comment: "Academic fit confirmed", created_at: "2026-01-15T08:00:00Z", actor: users[1] },
      { id: 13, from_stage: "linkages_review", to_stage: "linkages_review", action: "approve_linkages", comment: "Strategic fit confirmed", created_at: "2026-01-18T08:00:00Z", actor: users[2] },
      { id: 14, from_stage: "linkages_review", to_stage: "legal_review", action: "send_legal", comment: "Sent to Legal", created_at: "2026-08-01T08:00:00Z", actor: users[2] }
    ] }),
    makeAgreement(2, { reference_number: "JKUAT-MOU-2026-0002", title: "County Innovation and Student Placement Partnership", partner: partners[1], stage: "department_approval", status: "pending_department", status_color: "yellow", next_action: "Department/faculty approval required", owner: users[0], department: "Agricultural Engineering" }),
    makeAgreement(3, { reference_number: "JKUAT-CA-2026-0003", title: "Manufacturing Research Collaboration", agreement_type: "CA", partner: partners[1], stage: "dvc_approval", status: "legal_approved", status_color: "green", next_action: "DVC RPE endorsement required", workflow_events: [{ id: 30, from_stage: "legal_review", to_stage: "dvc_approval", action: "approve_legal", comment: "Legal draft approved", created_at: "2026-08-01T08:00:00Z", actor: users[4] }] }),
    makeAgreement(4, { reference_number: "JKUAT-CRA-2026-0004", title: "Climate Data and Resilience Collaboration", agreement_type: "CRA", partner: partners[3], stage: "vc_submission", status: "dvc_approved", status_color: "green", next_action: "Linkages to submit the endorsed package to VC Office", workflow_events: [{ id: 40, from_stage: "dvc_approval", to_stage: "vc_submission", action: "approve_dvc", comment: "DVC RPE endorsed", created_at: "2026-08-02T08:00:00Z", actor: users[5] }] }),
    makeAgreement(5, { reference_number: "JKUAT-MOU-2026-0005", title: "International Exchange and Joint Training MoU", partner: partners[4], stage: "validation_signing", status: "awaiting_vc_signature", status_color: "yellow", next_action: "VC Office to record signature milestone", date_sent_vc: "2026-08-01", workflow_events: [{ id: 50, from_stage: "vc_submission", to_stage: "validation_signing", action: "submit_vc", comment: "Package submitted", created_at: "2026-08-01T08:00:00Z", actor: users[2] }] }),
    makeAgreement(6, { reference_number: "JKUAT-MOU-2025-0006", title: "Artificial Intelligence Exchange Programme", partner: partners[4], stage: "active", status: "active", status_color: "green", next_action: "Submit the next six-month M&E report", effective_date: "2026-01-15", expiry_date: "2029-01-14", signing_date: "2026-01-10", documents: [{ id: 6, agreement_id: 6, document_type: "signed", version: "1.0", original_name: "Final_Signed_Agreement.pdf", mime_type: "application/pdf", size_bytes: 64000, is_official: true, confidentiality: "internal", created_at: "2026-01-10T08:00:00Z" }], deliverables: [{ id: 1, agreement_id: 6, deliverable_type: "Train postgraduate researchers", target_value: 20, actual_value: 14, reporting_period: "2026 H1", notes: "Exchange activities underway", evidence_document_id: null, last_updated_at: "2026-06-30T08:00:00Z" }], values: [{ id: 1, agreement_id: 6, value_type: "Research support", amount: 2500000, currency: "KES", source: "Signed work plan", reporting_period: "2026 H1", approved: true }] }),
    makeAgreement(7, { reference_number: "JKUAT-MOU-2026-0007", title: "Climate Innovation and Capacity Building", partner: partners[3], stage: "initiation", status: "correction_required", status_color: "yellow", next_action: "Champion to correct and resubmit", workflow_events: [{ id: 70, from_stage: "linkages_review", to_stage: "initiation", action: "return_correction", comment: "Exact item: Project budget. Requested change: Upload the approved institutional contribution plan.", created_at: "2026-08-05T08:00:00Z", actor: users[2] }] })
  ];

  return {
    users,
    partners,
    agreements,
    notifications: [{ id: 1, user_id: 3, title: "Legal review update", message: "JKUAT-CRA-2026-0001 is currently under Legal review.", level: "info", is_read: false, agreement_id: 1, created_at: "2026-08-05T08:00:00Z" }],
    audit: [{ id: 1, action: "create_agreement", object_type: "agreement", object_id: "1", old_value: null, new_value: "JKUAT-CRA-2026-0001", source_ip: "127.0.0.1", created_at: "2026-01-10T08:00:00Z", actor: users[0] }],
    next: { user: 12, partner: 6, agreement: 8, document: 20, workflow: 100, deliverable: 10, value: 10, notification: 10, audit: 10 }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* reset below */ }
  const state = initialState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
function fail(detail, status = 400) { return json({ detail }, status); }
function token(options) { const value = new Headers(options.headers || {}).get("Authorization") || ""; return value.startsWith("Bearer ") ? value.slice(7) : ""; }
function currentUser(state, options) { const value = token(options); const id = value.startsWith(TOKEN_PREFIX) ? Number(value.slice(TOKEN_PREFIX.length)) : NaN; return state.users.find((item) => item.id === id) || null; }
async function body(options) {
  if (!options.body) return {};
  if (options.body instanceof FormData) { const output = {}; for (const [key, value] of options.body.entries()) output[key] = value; return output; }
  if (typeof options.body === "string") { try { return JSON.parse(options.body); } catch { return {}; } }
  return options.body;
}
function addAudit(state, actor, action, objectType, objectId, oldValue = null, newValue = null) {
  state.audit.unshift({ id: state.next.audit++, action, object_type: objectType, object_id: String(objectId), old_value: oldValue, new_value: newValue, source_ip: "127.0.0.1", created_at: now(), actor: actor || null });
}
function scoped(state, actor) {
  if (["linkages", "director_linkages", "executive", "admin", "auditor"].includes(actor.role)) return state.agreements;
  if (actor.role === "researcher") return state.agreements.filter((item) => item.owner.id === actor.id);
  if (actor.role === "approver") return state.agreements.filter((item) => item.department === actor.department || item.stage === "department_approval");
  if (actor.role === "legal") return state.agreements.filter((item) => item.stage === "legal_review" || item.workflow_events.some((event) => event.action === "approve_legal"));
  if (actor.role === "dvc") return state.agreements.filter((item) => ["dvc_approval", "vc_submission", "validation_signing", "active"].includes(item.stage));
  if (actor.role === "vc_office") return state.agreements.filter((item) => ["validation_signing", "active"].includes(item.stage));
  if (actor.role === "me") return state.agreements.filter((item) => ["active", "renewal_closure"].includes(item.stage));
  return [];
}
function listShape(item) {
  const { purpose, expected_outcomes, strategic_alignment, confidentiality, internal_champion, partner_liaison, signing_date, date_sent_vc, date_sent_partner, documents, workflow_events, deliverables, values, ...list } = item;
  return list;
}

const transitionMap = {
  submit: ["department_approval", "pending_department", "yellow", "Department/faculty approval required"],
  approve_department: ["linkages_review", "pending_linkages", "yellow", "Linkages completeness and strategic-fit review"],
  return_correction: ["initiation", "correction_required", "yellow", "Champion to correct and resubmit"],
  approve_linkages: ["linkages_review", "linkages_approved", "green", "Route the approved request to Legal Office"],
  send_legal: ["legal_review", "in_legal_review", "green", "Legal Office review in progress"],
  approve_legal: ["dvc_approval", "legal_approved", "green", "DVC RPE endorsement required"],
  approve_dvc: ["vc_submission", "dvc_approved", "green", "Linkages to submit the endorsed package to VC Office"],
  return_dvc: ["legal_review", "dvc_returned", "yellow", "Address DVC RPE remarks and resubmit for endorsement"],
  submit_vc: ["validation_signing", "awaiting_vc_signature", "yellow", "VC Office to record signature milestone"],
  record_vc_signature: ["validation_signing", "awaiting_partner_signature", "yellow", "Await partner signature and complete execution"],
  mark_signed: ["validation_signing", "fully_signed", "green", "Complete activation information"],
  activate: ["active", "active", "green", "Update six-month M&E reports, deliverables and evidence"],
  renew: ["renewal_closure", "renewal_review", "orange", "Complete renewal decision"],
  close: ["renewal_closure", "closed", "green", "Archive completed agreement"],
  archive: ["archived", "archived", "green", "Read-only institutional record"],
  reject: ["renewal_closure", "rejected", "red", "No further action"]
};
const allowedRoles = {
  submit: ["researcher", "linkages", "director_linkages"], approve_department: ["approver"], return_correction: ["approver", "linkages", "director_linkages", "legal"], approve_linkages: ["linkages", "director_linkages"], send_legal: ["linkages", "director_linkages"], approve_legal: ["legal"], approve_dvc: ["dvc"], return_dvc: ["dvc"], submit_vc: ["linkages", "director_linkages"], record_vc_signature: ["vc_office"], mark_signed: ["vc_office", "linkages", "director_linkages"], activate: ["linkages", "director_linkages"], renew: ["linkages", "director_linkages"], close: ["linkages", "director_linkages"], archive: ["linkages", "director_linkages"], reject: ["approver", "linkages", "director_linkages", "legal", "dvc"]
};
const allowedStages = {
  submit: ["initiation"], approve_department: ["department_approval"], return_correction: ["department_approval", "linkages_review", "legal_review"], approve_linkages: ["linkages_review"], send_legal: ["linkages_review"], approve_legal: ["legal_review"], approve_dvc: ["dvc_approval"], return_dvc: ["dvc_approval"], submit_vc: ["vc_submission"], record_vc_signature: ["validation_signing"], mark_signed: ["validation_signing"], activate: ["validation_signing"], renew: ["active"], close: ["active", "renewal_closure"], archive: ["renewal_closure"], reject: ["department_approval", "linkages_review", "legal_review", "dvc_approval", "vc_submission", "validation_signing"]
};

function dashboardWorkspace(state, actor) {
  const records = scoped(state, actor);
  const queue = records.filter((item) => {
    const roleStage = { researcher: ["initiation", "active"], approver: ["department_approval"], linkages: ["linkages_review", "vc_submission", "validation_signing"], director_linkages: ["linkages_review", "vc_submission", "validation_signing", "renewal_closure"], legal: ["legal_review"], dvc: ["dvc_approval"], vc_office: ["validation_signing"], me: ["active"], executive: [], admin: [], auditor: [] };
    return (roleStage[actor.role] || []).includes(item.stage);
  });
  return {
    role: actor.role,
    role_label: actor.role.replaceAll("_", " "),
    eyebrow: "Role workspace",
    title: "Accord360 institutional workspace",
    description: "Contract-shaped demonstration workspace.",
    permission_summary: "The real backend enforces authentication, role checks and agreement scope.",
    capabilities: ["View authorized records", "Use documented API actions"],
    guidance: ["Open records requiring your role.", "Use only actions allowed by the current stage."],
    queue_title: "Required actions",
    queue_description: "Records are scoped to the signed-in role.",
    primary_action: ["researcher", "linkages", "director_linkages"].includes(actor.role) ? { label: "New collaboration request", path: "/agreements/new" } : null,
    show_portfolio_analytics: ["linkages", "director_linkages", "dvc", "me", "executive"].includes(actor.role),
    metrics: [
      { label: "Authorized records", value: records.length, note: "Backend-scoped", icon: "agreements", tone: "green" },
      { label: "Required actions", value: queue.length, note: "Current queue", icon: "pending", tone: "blue" },
      { label: "Active", value: records.filter((item) => item.stage === "active").length, note: "Implementation", icon: "complete", tone: "green" },
      { label: "At risk", value: records.filter((item) => ["orange", "red"].includes(item.status_color)).length, note: "Attention", icon: "risk", tone: "orange" }
    ],
    queue: queue.slice(0, 12).map((item) => ({ id: item.id, reference_number: item.reference_number, title: item.title, partner: item.partner.name, stage: item.stage, status: item.status, status_color: item.status_color, next_action: item.next_action }))
  };
}
function dashboardStats(state, actor) {
  const records = scoped(state, actor);
  const count = (key) => [...records.reduce((map, item) => map.set(item[key], (map.get(item[key]) || 0) + 1), new Map())].map(([name, value]) => ({ name, value }));
  const values = new Map();
  records.flatMap((item) => item.values).filter((item) => item.approved).forEach((item) => values.set(item.currency, (values.get(item.currency) || 0) + Number(item.amount)));
  return { kpis: { active_partnerships: records.filter((item) => item.stage === "active").length, pipeline_volume: records.filter((item) => !["active", "renewal_closure", "archived"].includes(item.stage)).length, at_risk: records.filter((item) => ["orange", "red"].includes(item.status_color)).length, value_by_currency: [...values].map(([currency, amount]) => ({ currency, amount })) }, by_stage: count("stage"), by_type: count("agreement_type"), by_risk: count("status_color"), monthly_pipeline: [{ month: "Aug 2026", count: records.length }], recent_agreements: records.slice(0, 6).map((item) => ({ id: item.id, reference_number: item.reference_number, title: item.title, partner: item.partner.name, stage: item.stage, status: item.status, status_color: item.status_color, next_action: item.next_action, updated_at: item.updated_at })) };
}

export async function mockRequest(path, options = {}) {
  const state = loadState();
  const method = String(options.method || "GET").toUpperCase();
  const url = new URL(path, "http://mock.local");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const payload = await body(options);

  if (pathname === "/auth/login" && method === "POST") {
    const actor = state.users.find((item) => item.email.toLowerCase() === String(payload.email || "").toLowerCase());
    if (!actor || credentials[actor.email] !== payload.password || !actor.is_active) return fail("Invalid email or password", 401);
    return json({ access_token: `${TOKEN_PREFIX}${actor.id}`, token_type: "bearer", user: actor });
  }

  const actor = currentUser(state, options);
  if (!actor) return fail("Not authenticated", 401);

  if (pathname === "/auth/me" && method === "GET") return json(actor);
  if (pathname === "/dashboard/workspace" && method === "GET") return json(dashboardWorkspace(state, actor));
  if (pathname === "/dashboard/stats" && method === "GET") return json(dashboardStats(state, actor));

  if (pathname === "/users" && method === "GET") return actor.role === "admin" ? json(state.users) : fail("Not enough permissions", 403);
  if (pathname === "/users/champions" && method === "GET") return ["admin", "linkages", "director_linkages"].includes(actor.role) ? json(state.users.filter((item) => item.role === "researcher" && item.is_active)) : fail("Not enough permissions", 403);
  if (pathname === "/users" && method === "POST") {
    if (actor.role !== "admin") return fail("Not enough permissions", 403);
    if (state.users.some((item) => item.email.toLowerCase() === String(payload.email).toLowerCase())) return fail("Email already exists", 409);
    const created = { id: state.next.user++, full_name: payload.full_name, email: String(payload.email).toLowerCase(), role: payload.role || "researcher", department: payload.department || null, is_active: true, created_at: now() };
    state.users.push(created); credentials[created.email] = payload.password; addAudit(state, actor, "create_user", "user", created.id, null, `role=${created.role}`); saveState(state); return json(created, 201);
  }
  const userMatch = pathname.match(/^\/users\/(\d+)$/);
  if (userMatch && method === "PATCH") {
    if (actor.role !== "admin") return fail("Not enough permissions", 403);
    const item = state.users.find((entry) => entry.id === Number(userMatch[1])); if (!item) return fail("User not found", 404);
    Object.assign(item, payload); addAudit(state, actor, "update_user", "user", item.id, null, JSON.stringify(payload)); saveState(state); return json(item);
  }

  if (pathname === "/partners" && method === "GET") return json(state.partners);
  if (pathname === "/partners" && method === "POST") {
    if (!["researcher", "linkages", "director_linkages"].includes(actor.role)) return fail("Not enough permissions", 403);
    if (state.partners.some((item) => item.name === payload.name)) return fail("Partner already exists", 409);
    const created = { id: state.next.partner++, name: payload.name, sector: payload.sector, partner_type: payload.partner_type || "Institution", country: payload.country || "Kenya", contact_name: payload.contact_name || null, contact_email: payload.contact_email || null, legal_counterpart: payload.legal_counterpart || null, liaison: payload.liaison || null, status: payload.status || "active", created_at: now() };
    state.partners.push(created); addAudit(state, actor, "create_partner", "partner", created.id, null, created.name); saveState(state); return json(created, 201);
  }
  const partnerMatch = pathname.match(/^\/partners\/(\d+)$/);
  if (partnerMatch && method === "PUT") {
    if (!["linkages", "director_linkages"].includes(actor.role)) return fail("Not enough permissions", 403);
    const item = state.partners.find((entry) => entry.id === Number(partnerMatch[1])); if (!item) return fail("Partner not found", 404);
    Object.assign(item, payload); addAudit(state, actor, "update_partner", "partner", item.id, null, item.name); saveState(state); return json(item);
  }

  if (pathname === "/agreements" && method === "GET") {
    let records = scoped(state, actor);
    const search = url.searchParams.get("search")?.toLowerCase();
    if (search) records = records.filter((item) => [item.title, item.reference_number, item.partner.name].some((value) => value.toLowerCase().includes(search)));
    for (const key of ["stage", "status", "agreement_type", "department"]) { const value = url.searchParams.get(key); if (value) records = records.filter((item) => item[key] === value); }
    return json(records.map(listShape));
  }
  if (pathname === "/agreements" && method === "POST") {
    if (!["researcher", "linkages", "director_linkages"].includes(actor.role)) return fail("Only Champions and Linkages officers can create collaboration requests", 403);
    const partner = state.partners.find((item) => item.id === Number(payload.partner_id)); if (!partner) return fail("Partner not found", 404);
    let owner = actor;
    if (["linkages", "director_linkages"].includes(actor.role)) { owner = state.users.find((item) => item.id === Number(payload.champion_user_id) && item.role === "researcher" && item.is_active); if (!owner) return fail("The assigned Champion must be an active JKUAT Champion account", 400); }
    const id = state.next.agreement++;
    const created = { id, reference_number: `JKUAT-${String(payload.agreement_type).replace(/[^a-z0-9]/gi, "").toUpperCase()}-2026-${String(id).padStart(4, "0")}`, title: payload.title, agreement_type: payload.agreement_type, purpose: payload.purpose, expected_outcomes: payload.expected_outcomes || null, strategic_alignment: payload.strategic_alignment || null, department: payload.department, stage: "initiation", status: "draft", status_color: "green", next_action: "Complete the request and submit for departmental approval", partner, owner, confidentiality: payload.confidentiality || "internal", internal_champion: payload.internal_champion || owner.full_name, partner_liaison: payload.partner_liaison || null, effective_date: payload.effective_date || null, expiry_date: payload.expiry_date || null, signing_date: null, date_sent_vc: null, date_sent_partner: null, legal_review_days: null, days_to_expiry: null, documents: [], workflow_events: [{ id: state.next.workflow++, from_stage: null, to_stage: "initiation", action: "create", comment: "Collaboration request created", created_at: now(), actor }], deliverables: [], values: [], created_at: now(), updated_at: now() };
    state.agreements.push(created); addAudit(state, actor, "create_agreement", "agreement", id, null, created.reference_number); saveState(state); return json(created, 201);
  }
  const agreementMatch = pathname.match(/^\/agreements\/(\d+)$/);
  if (agreementMatch && method === "GET") { const item = scoped(state, actor).find((entry) => entry.id === Number(agreementMatch[1])); return item ? json(item) : fail("Agreement not found", 404); }
  if (agreementMatch && method === "PATCH") {
    const item = scoped(state, actor).find((entry) => entry.id === Number(agreementMatch[1])); if (!item) return fail("Agreement not found", 404);
    Object.assign(item, payload, { updated_at: now() }); addAudit(state, actor, "update_agreement", "agreement", item.id, null, JSON.stringify(payload)); saveState(state); return json(item);
  }
  const transitionMatch = pathname.match(/^\/agreements\/(\d+)\/transition$/);
  if (transitionMatch && method === "POST") {
    const item = scoped(state, actor).find((entry) => entry.id === Number(transitionMatch[1])); if (!item) return fail("Agreement not found", 404);
    const action = payload.action; if (!transitionMap[action]) return fail("Unsupported workflow action", 422);
    if (!allowedRoles[action]?.includes(actor.role)) return fail(`Role '${actor.role}' cannot perform '${action}'`, 403);
    if (!allowedStages[action]?.includes(item.stage)) return fail(`Action '${action}' is not valid while the agreement is in '${item.stage}'`, 400);
    if (["return_correction", "return_dvc", "reject", "close"].includes(action) && !String(payload.comment || "").trim()) return fail("A reason/comment is required for this action", 400);
    if (action === "activate") { const missing = []; if (!item.signing_date) missing.push("signing date"); if (!item.effective_date) missing.push("effective date"); if (!item.expiry_date) missing.push("expiry date"); if (!item.internal_champion) missing.push("internal Champion"); if (!item.partner_liaison) missing.push("partner liaison"); if (!item.deliverables.length) missing.push("at least one M&E deliverable target"); if (!item.documents.some((doc) => doc.document_type === "signed" && doc.is_official)) missing.push("official signed agreement document"); if (missing.length) return fail(`Activation requires: ${missing.join(", ")}`, 400); }
    const from = item.stage; const [stage, status, color, nextAction] = transitionMap[action]; Object.assign(item, { stage, status, status_color: color, next_action: nextAction, updated_at: now() }); if (action === "submit_vc" && !item.date_sent_vc) item.date_sent_vc = new Date().toISOString().slice(0, 10); if (action === "mark_signed" && !item.signing_date) item.signing_date = new Date().toISOString().slice(0, 10);
    item.workflow_events.push({ id: state.next.workflow++, from_stage: from, to_stage: stage, action, comment: payload.comment || null, created_at: now(), actor }); addAudit(state, actor, `workflow_${action}`, "agreement", item.id, from, stage); saveState(state); return json(item);
  }

  const docsListMatch = pathname.match(/^\/agreements\/(\d+)\/documents$/);
  if (docsListMatch && method === "GET") { const item = scoped(state, actor).find((entry) => entry.id === Number(docsListMatch[1])); return item ? json(item.documents) : fail("Agreement not found", 404); }
  if (docsListMatch && method === "POST") {
    const item = scoped(state, actor).find((entry) => entry.id === Number(docsListMatch[1])); if (!item) return fail("Agreement not found", 404);
    const file = payload.file; if (!file) return fail("file is required", 422);
    const document = { id: state.next.document++, agreement_id: item.id, document_type: payload.document_type || "supporting", version: payload.version || "1.0", original_name: file.name || "uploaded-file", mime_type: file.type || "application/octet-stream", size_bytes: Number(file.size || 0), is_official: String(payload.is_official).toLowerCase() === "true", confidentiality: payload.confidentiality || "internal", created_at: now() };
    item.documents.push(document); addAudit(state, actor, "upload_document", "document", document.id, null, document.original_name); saveState(state); return json(document, 201);
  }
  const downloadMatch = pathname.match(/^\/agreements\/(\d+)\/documents\/(\d+)\/download$/);
  if (downloadMatch && method === "GET") { const item = scoped(state, actor).find((entry) => entry.id === Number(downloadMatch[1])); const document = item?.documents.find((entry) => entry.id === Number(downloadMatch[2])); return document ? new Response(new Blob([`Mock file: ${document.original_name}`]), { status: 200, headers: { "Content-Type": document.mime_type || "application/octet-stream", "Content-Disposition": `attachment; filename="${document.original_name}"` } }) : fail("Document not found", 404); }

  const deliverableCreateMatch = pathname.match(/^\/agreements\/(\d+)\/deliverables$/);
  if (deliverableCreateMatch && method === "POST") { const item = scoped(state, actor).find((entry) => entry.id === Number(deliverableCreateMatch[1])); if (!item) return fail("Agreement not found", 404); const created = { id: state.next.deliverable++, agreement_id: item.id, ...payload, target_value: Number(payload.target_value || 0), actual_value: Number(payload.actual_value || 0), last_updated_at: now() }; item.deliverables.push(created); addAudit(state, actor, "create_deliverable", "deliverable", created.id, null, created.deliverable_type); saveState(state); return json(created, 201); }
  const deliverableUpdateMatch = pathname.match(/^\/agreements\/(\d+)\/deliverables\/(\d+)$/);
  if (deliverableUpdateMatch && method === "PUT") { const item = scoped(state, actor).find((entry) => entry.id === Number(deliverableUpdateMatch[1])); const deliverable = item?.deliverables.find((entry) => entry.id === Number(deliverableUpdateMatch[2])); if (!deliverable) return fail("Deliverable not found", 404); Object.assign(deliverable, payload, { target_value: Number(payload.target_value || 0), actual_value: Number(payload.actual_value || 0), last_updated_at: now() }); addAudit(state, actor, "update_deliverable", "deliverable", deliverable.id, null, deliverable.deliverable_type); saveState(state); return json(deliverable); }
  const valueMatch = pathname.match(/^\/agreements\/(\d+)\/values$/);
  if (valueMatch && method === "POST") { const item = scoped(state, actor).find((entry) => entry.id === Number(valueMatch[1])); if (!item) return fail("Agreement not found", 404); const created = { id: state.next.value++, agreement_id: item.id, ...payload, amount: Number(payload.amount || 0), currency: String(payload.currency || "KES").toUpperCase(), approved: actor.role === "me" ? false : Boolean(payload.approved) }; item.values.push(created); addAudit(state, actor, "create_value_record", "value_record", created.id, null, `${created.currency} ${created.amount}`); saveState(state); return json(created, 201); }

  if (pathname === "/notifications" && method === "GET") return json(state.notifications.filter((item) => item.user_id === actor.id).slice(0, 50));
  const readMatch = pathname.match(/^\/notifications\/(\d+)\/read$/);
  if (readMatch && method === "POST") { const item = state.notifications.find((entry) => entry.id === Number(readMatch[1]) && entry.user_id === actor.id); if (!item) return fail("Notification not found", 404); item.is_read = true; saveState(state); return json(item); }

  if (pathname === "/reports/audit" && method === "GET") return ["admin", "auditor", "executive", "director_linkages"].includes(actor.role) ? json(state.audit.slice(0, Number(url.searchParams.get("limit") || 100))) : fail("Not enough permissions", 403);
  if (pathname === "/reports/agreements.csv" && method === "GET") { const records = scoped(state, actor); const csv = ["Reference,Title,Type,Partner,Stage,Status", ...records.map((item) => [item.reference_number, item.title, item.agreement_type, item.partner.name, item.stage, item.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n"); return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="accord360-agreements.csv"' } }); }

  return fail("Route not found", 404);
}
