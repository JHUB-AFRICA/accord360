class MemoryStorage {
  #data = new Map();
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  setItem(key, value) { this.#data.set(key, String(value)); }
  removeItem(key) { this.#data.delete(key); }
  clear() { this.#data.clear(); }
}

globalThis.localStorage = new MemoryStorage();
const { mockRequest } = await import("../src/lib/mockApi.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = "GET", body, form } = {}) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let requestBody;
  if (form) requestBody = form;
  else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }
  const response = await mockRequest(path, { method, headers, body: requestBody });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}

const accounts = [
  ["researcher", "researcher@accord360.app", "Research@123"],
  ["approver", "approver@accord360.app", "Approver@123"],
  ["linkages", "linkages@accord360.app", "Linkages@123"],
  ["director_linkages", "director.linkages@accord360.app", "Director@123"],
  ["legal", "legal@accord360.app", "Legal@123"],
  ["dvc", "dvc.rpe@accord360.app", "DvcRpe@123"],
  ["vc_office", "vc.office@accord360.app", "VcOffice@123"],
  ["me", "me@accord360.app", "Measure@123"],
  ["executive", "executive@accord360.app", "Executive@123"],
  ["admin", "admin@accord360.app", "Admin@123"],
  ["auditor", "auditor@accord360.app", "Auditor@123"]
];
const sessions = {};
for (const [role, email, password] of accounts) {
  const login = await request("/auth/login", { method: "POST", body: { email, password } });
  assert(login.response.status === 200, `${role} login failed`);
  assert(login.payload.user.role === role, `${role} response role mismatch`);
  assert(Number.isInteger(login.payload.user.id), `${role} ID must be an integer`);
  sessions[role] = login.payload.access_token;
  const me = await request("/auth/me", { token: sessions[role] });
  assert(me.response.status === 200 && me.payload.role === role, `${role} /auth/me failed`);
  const workspace = await request("/dashboard/workspace", { token: sessions[role] });
  const stats = await request("/dashboard/stats", { token: sessions[role] });
  assert(workspace.response.status === 200 && workspace.payload.role === role, `${role} workspace failed`);
  assert(stats.response.status === 200 && stats.payload.kpis, `${role} stats failed`);
}

const badLogin = await request("/auth/login", { method: "POST", body: { email: "admin@accord360.app", password: "wrong" } });
assert(badLogin.response.status === 401, "Invalid login must return 401");

const adminUsers = await request("/users", { token: sessions.admin });
assert(adminUsers.response.status === 200 && adminUsers.payload.length === 11, "GET /users failed");
const champions = await request("/users/champions", { token: sessions.linkages });
assert(champions.response.status === 200 && champions.payload.every((item) => item.role === "researcher"), "GET /users/champions failed");
const createdUser = await request("/users", { token: sessions.admin, method: "POST", body: { full_name: "Test Researcher", email: "test.researcher@example.com", password: "Password123", role: "researcher", department: "Computing" } });
assert(createdUser.response.status === 201 && Number.isInteger(createdUser.payload.id), "POST /users failed");
const disabledUser = await request(`/users/${createdUser.payload.id}`, { token: sessions.admin, method: "PATCH", body: { is_active: false } });
assert(disabledUser.response.status === 200 && disabledUser.payload.is_active === false, "PATCH /users/:id failed");

const partners = await request("/partners", { token: sessions.researcher });
assert(partners.response.status === 200 && partners.payload.length > 0, "GET /partners failed");
const createdPartner = await request("/partners", { token: sessions.researcher, method: "POST", body: { name: "Contract Test Institution", sector: "Education", partner_type: "Institution", country: "Kenya", status: "active" } });
assert(createdPartner.response.status === 201, "POST /partners failed");
const updatedPartner = await request(`/partners/${createdPartner.payload.id}`, { token: sessions.linkages, method: "PUT", body: { ...createdPartner.payload, status: "under_review" } });
assert(updatedPartner.response.status === 200 && updatedPartner.payload.status === "under_review", "PUT /partners/:id failed");

const agreementList = await request("/agreements?agreement_type=CRA", { token: sessions.linkages });
assert(agreementList.response.status === 200 && agreementList.payload.every((item) => item.agreement_type === "CRA"), "Agreement query contract failed");
const createdAgreement = await request("/agreements", { token: sessions.researcher, method: "POST", body: { title: "Contract Integration Agreement", agreement_type: "MoU", purpose: "A detailed purpose that passes backend validation.", expected_outcomes: "One tested integration", strategic_alignment: "Digital transformation", department: "Public Health", partner_id: 1, confidentiality: "internal" } });
assert(createdAgreement.response.status === 201 && Number.isInteger(createdAgreement.payload.id), "POST /agreements failed");
const submitted = await request(`/agreements/${createdAgreement.payload.id}/transition`, { token: sessions.researcher, method: "POST", body: { action: "submit", comment: "Ready for review" } });
assert(submitted.response.status === 200 && submitted.payload.stage === "department_approval", "Submit transition failed");

const form = new FormData();
form.append("file", new Blob(["test document"], { type: "application/pdf" }), "Contract_Test.pdf");
form.append("document_type", "supporting");
form.append("version", "1.0");
form.append("confidentiality", "internal");
form.append("is_official", "false");
const uploaded = await request(`/agreements/${createdAgreement.payload.id}/documents`, { token: sessions.researcher, method: "POST", form });
assert(uploaded.response.status === 201 && uploaded.payload.original_name === "Contract_Test.pdf", "Multipart document upload failed");
const downloaded = await request(`/agreements/${createdAgreement.payload.id}/documents/${uploaded.payload.id}/download`, { token: sessions.researcher });
assert(downloaded.response.status === 200, "Document download failed");

const facultyApproved = await request("/agreements/2/transition", { token: sessions.approver, method: "POST", body: { action: "approve_department", comment: "Academic fit confirmed" } });
assert(facultyApproved.response.status === 200 && facultyApproved.payload.stage === "linkages_review", "Faculty transition failed");
const linkagesApproved = await request("/agreements/2/transition", { token: sessions.linkages, method: "POST", body: { action: "approve_linkages", comment: "Strategic fit confirmed" } });
assert(linkagesApproved.response.status === 200 && linkagesApproved.payload.status === "linkages_approved", "Linkages approval failed");
const sentLegal = await request("/agreements/2/transition", { token: sessions.linkages, method: "POST", body: { action: "send_legal", comment: "Complete package" } });
assert(sentLegal.response.status === 200 && sentLegal.payload.stage === "legal_review", "Send Legal failed");
const legalApproved = await request("/agreements/2/transition", { token: sessions.legal, method: "POST", body: { action: "approve_legal", comment: "Legal draft approved" } });
assert(legalApproved.response.status === 200 && legalApproved.payload.stage === "dvc_approval", "Legal approval failed");
const dvcApproved = await request("/agreements/2/transition", { token: sessions.dvc, method: "POST", body: { action: "approve_dvc", comment: "Endorsed" } });
assert(dvcApproved.response.status === 200 && dvcApproved.payload.stage === "vc_submission", "DVC endorsement failed");
const submittedVc = await request("/agreements/2/transition", { token: sessions.linkages, method: "POST", body: { action: "submit_vc", comment: "Submitted to VC Office" } });
assert(submittedVc.response.status === 200 && submittedVc.payload.status === "awaiting_vc_signature", "VC submission failed");
const vcSigned = await request("/agreements/2/transition", { token: sessions.vc_office, method: "POST", body: { action: "record_vc_signature", comment: "VC signed" } });
assert(vcSigned.response.status === 200 && vcSigned.payload.status === "awaiting_partner_signature", "VC signature transition failed");
const fullySigned = await request("/agreements/2/transition", { token: sessions.vc_office, method: "POST", body: { action: "mark_signed", comment: "Partner signed" } });
assert(fullySigned.response.status === 200 && fullySigned.payload.status === "fully_signed", "Partner signature transition failed");

const signedForm = new FormData();
signedForm.append("file", new Blob(["signed"], { type: "application/pdf" }), "Final_Signed_Agreement.pdf");
signedForm.append("document_type", "signed");
signedForm.append("version", "1.0");
signedForm.append("confidentiality", "internal");
signedForm.append("is_official", "true");
const signedDocument = await request("/agreements/2/documents", { token: sessions.vc_office, method: "POST", form: signedForm });
assert(signedDocument.response.status === 201 && signedDocument.payload.is_official, "Official signed document upload failed");
const activationInfo = await request("/agreements/2", { token: sessions.linkages, method: "PATCH", body: { effective_date: "2026-09-01", expiry_date: "2029-08-31", partner_liaison: "David Mutua" } });
assert(activationInfo.response.status === 200, "Agreement activation update failed");
const baseline = await request("/agreements/2/deliverables", { token: sessions.linkages, method: "POST", body: { deliverable_type: "Submit implementation work plan", target_value: 1, actual_value: 0, reporting_period: "Activation baseline", notes: "Initial target", evidence_document_id: null } });
assert(baseline.response.status === 201, "Deliverable creation failed");
const activated = await request("/agreements/2/transition", { token: sessions.linkages, method: "POST", body: { action: "activate", comment: "Activation checklist complete" } });
assert(activated.response.status === 200 && activated.payload.stage === "active", "Activation transition failed");

const updatedDeliverable = await request(`/agreements/2/deliverables/${baseline.payload.id}`, { token: sessions.me, method: "PUT", body: { ...baseline.payload, actual_value: 1 } });
assert(updatedDeliverable.response.status === 200 && updatedDeliverable.payload.actual_value === 1, "Deliverable update failed");
const value = await request("/agreements/2/values", { token: sessions.me, method: "POST", body: { value_type: "Research funding", amount: 125000, currency: "KES", source: "Signed grant", reporting_period: "2026 H1", approved: true } });
assert(value.response.status === 201 && value.payload.approved === false, "M&E value approval rule failed");

const notifications = await request("/notifications", { token: sessions.linkages });
assert(notifications.response.status === 200, "GET /notifications failed");
if (notifications.payload.length) {
  const read = await request(`/notifications/${notifications.payload[0].id}/read`, { token: sessions.linkages, method: "POST" });
  assert(read.response.status === 200 && read.payload.is_read, "Notification read failed");
}
const csv = await request("/reports/agreements.csv?stage=active", { token: sessions.executive });
assert(csv.response.status === 200, "CSV export failed");
const audit = await request("/reports/audit?limit=100", { token: sessions.auditor });
assert(audit.response.status === 200 && Array.isArray(audit.payload), "Audit report failed");

const unsupported = await request("/dashboard", { token: sessions.admin });
assert(unsupported.response.status === 404, "Unsupported /dashboard route must remain unavailable");

console.log("Accord360 exact-contract mock smoke test passed.");
