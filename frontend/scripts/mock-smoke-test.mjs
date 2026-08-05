class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const { mockRequest } = await import("../src/lib/mockApi.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = "GET", body } = {}) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await mockRequest(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(email, password) {
  const { response, payload } = await request("/auth/login", { method: "POST", body: { email, password } });
  assert(response.status === 200, `Login failed for ${email}: ${JSON.stringify(payload)}`);
  return payload;
}

const accounts = [
  ["researcher@accord360.app", "Research@123", "researcher"],
  ["approver@accord360.app", "Approver@123", "approver"],
  ["linkages@accord360.app", "Linkages@123", "linkages"],
  ["director.linkages@accord360.app", "Director@123", "director_linkages"],
  ["legal@accord360.app", "Legal@123", "legal"],
  ["dvc.rpe@accord360.app", "DvcRpe@123", "dvc"],
  ["vc.office@accord360.app", "VcOffice@123", "vc_office"],
  ["me@accord360.app", "Measure@123", "me"],
  ["executive@accord360.app", "Executive@123", "executive"],
  ["admin@accord360.app", "Admin@123", "admin"],
  ["auditor@accord360.app", "Auditor@123", "auditor"],
  ["partner@eait.example", "Partner@123", "partner"]
];

const invalid = await request("/auth/login", { method: "POST", body: { email: "researcher@accord360.app", password: "wrong" } });
assert(invalid.response.status === 401, "Invalid password must return 401 and must never activate demo fallback.");
const resetRequest = await request("/auth/forgot-password", { method: "POST", body: { email: "researcher@accord360.app" } });
assert(resetRequest.response.status === 200 && resetRequest.payload.message, "Password-reset request contract failed.");

const publicRegistration = await request("/auth/register-partner", { method: "POST", body: {
  institution_name: "Smoke Test Innovation Institute",
  institution_type: "University",
  country: "Kenya",
  region: "Nairobi",
  website: "https://smoke.example",
  contact_name: "Test Contact",
  contact_email: "contact@smoke.example",
  collaboration_area: "Joint innovation testing",
  documents: [{ name: "Registration.pdf", size: 1024 }]
} });
assert(publicRegistration.response.status === 201 && publicRegistration.payload.reference, "Public partner registration failed");
const publicStatus = await request(`/auth/registration/${publicRegistration.payload.reference}`);
assert(publicStatus.response.status === 200 && publicStatus.payload.status === "pending_review", "Public registration status tracking failed");

const sessions = {};
for (const [email, password, role] of accounts) {
  const session = await login(email, password);
  assert(session.user.role === role, `${email} routed to unexpected role ${session.user.role}`);
  sessions[role] = session;
  const me = await request("/auth/me", { token: session.access_token });
  assert(me.response.status === 200 && me.payload.role === role, `/auth/me failed for ${role}`);
  const dashboard = await request("/dashboard", { token: session.access_token });
  assert(dashboard.response.status === 200 && Array.isArray(dashboard.payload.kpis), `Dashboard failed for ${role}`);
}

const adminToken = sessions.admin.access_token;
let result = await request("/mock/reset", { token: adminToken, method: "POST", body: {} });
assert(result.response.status === 200, "Admin mock reset failed");

const researcherToken = sessions.researcher.access_token;
result = await request("/directory/champions", { token: researcherToken });
assert(result.response.status === 200 && result.payload.length > 0, "Champion directory unavailable to request creator");
assert(result.payload.every((item) => !Object.hasOwn(item, "password")), "Champion directory exposed passwords");
const champion = result.payload[0];
const referenceData = await request("/reference-data", { token: researcherToken });
assert(referenceData.response.status === 200 && referenceData.payload.agreement_types.length > 0 && referenceData.payload.required_document_rules.length > 0, "Reference-data endpoint failed");

const partners = await request("/partners", { token: researcherToken });
const templates = await request("/templates", { token: researcherToken });
assert(partners.response.status === 200 && partners.payload.length > 0, "Researcher partner lookup failed");
assert(templates.response.status === 200 && templates.payload.length > 0, "Template lookup failed");
const partner = partners.payload.find((item) => item.verification_status === "verified") || partners.payload[0];
const template = templates.payload.find((item) => item.agreement_type === "MoU" && item.status === "active") || templates.payload[0];

const partnerVerification = await request("/partners/par-greenfields/verify", {
  token: sessions.linkages.access_token,
  method: "POST",
  body: { decision: "approve", reason: "Registration, website and accreditation evidence verified.", champion_id: champion.id }
});
assert(partnerVerification.response.status === 200 && partnerVerification.payload.verification_status === "verified" && partnerVerification.payload.champion_id, "Partner verification and Champion assignment failed");

const facultyApproval = await request("/agreements/agr-0037/actions/approve_faculty", { token: sessions.approver.access_token, method: "POST", body: {} });
assert(facultyApproval.response.status === 200 && facultyApproval.payload.stage === "linkages_review", "Faculty approval transition failed");
const linkagesApproval = await request("/agreements/agr-0037/actions/approve_linkages", { token: sessions.linkages.access_token, method: "POST", body: {} });
assert(linkagesApproval.response.status === 200 && linkagesApproval.payload.stage === "legal_review", "Linkages approval transition failed");

const correctionResponse = await request("/corrections/cor-024/respond", {
  token: researcherToken,
  method: "POST",
  body: { response: "Added measurable outcomes, responsible offices and target dates.", replacement_document: { name: "Updated_Outcomes.docx" } }
});
assert(correctionResponse.response.status === 200 && correctionResponse.payload.status === "submitted", "Structured correction response failed");
const correctionResolution = await request("/corrections/cor-024/resolve", {
  token: sessions.linkages.access_token,
  method: "POST",
  body: { note: "Updated outcomes satisfy the correction request." }
});
assert(correctionResolution.response.status === 200 && correctionResolution.payload.status === "resolved", "Correction resolution failed");

result = await request("/agreements", {
  token: researcherToken,
  method: "POST",
  body: {
    partner_id: partner.id,
    title: "Smoke Test Partnership Request",
    agreement_type: template.agreement_type,
    purpose: "Verify the complete frontend request contract.",
    collaboration_area: "Digital institutional collaboration",
    strategic_alignment: "Supports JKUAT research and innovation priorities.",
    intended_start_date: "2026-09-01",
    proposed_duration_months: 24,
    expected_outcomes: ["One joint programme", "Two documented outputs"],
    faculty: "College of Engineering and Technology",
    department: "Computing",
    champion_id: champion.id,
    template_id: template.id,
    documents: [],
    submit: false
  }
});
assert(result.response.status === 201 && result.payload.status === "draft", "Agreement draft creation failed");
const createdAgreement = result.payload;

const scopedResearcherAgreements = await request("/agreements", { token: researcherToken });
assert(scopedResearcherAgreements.payload.some((item) => item.id === createdAgreement.id), "Created agreement missing from researcher scope");

const adminAgreements = await request("/agreements", { token: adminToken });
assert(adminAgreements.response.status === 200 && adminAgreements.payload.length >= scopedResearcherAgreements.payload.length, "Admin read scope failed");

const partnerToken = sessions.partner.access_token;
const partnerAgreements = await request("/agreements", { token: partnerToken });
assert(partnerAgreements.response.status === 200, "Partner agreement scope failed");

const config = await request("/configuration", { token: adminToken });
assert(config.response.status === 200, "Configuration load failed");
const invalidWeights = structuredClone(config.payload);
invalidWeights.scoring_weights = invalidWeights.scoring_weights.map((item, index) => ({ ...item, weight: index === 0 ? 99 : 0 }));
result = await request("/configuration", { token: adminToken, method: "PATCH", body: invalidWeights });
assert(result.response.status === 422, "Invalid scoring weights must be rejected");

const documentUpload = await request(`/agreements/${createdAgreement.id}/documents`, {
  token: researcherToken,
  method: "POST",
  body: { name: "Smoke_Test_Concept_Note.pdf", size: 2048, mime_type: "application/pdf", type: "Supporting document", confidentiality: "internal" }
});
assert(documentUpload.response.status === 201, "Agreement document upload contract failed");
const documentDownload = await request(`/agreements/${createdAgreement.id}/documents/${documentUpload.payload.id}/download`, { token: researcherToken });
assert(documentDownload.response.status === 200, "Agreement document download contract failed");

const profileUpdate = await request("/partners/par-eait", { token: partnerToken, method: "PATCH", body: { contact_name: "Anne Achieng", contact_phone: "+254700000000" } });
assert(profileUpdate.response.status === 200 && profileUpdate.payload.contact_phone === "+254700000000", "Partner profile update failed");

const legalToken = sessions.legal.access_token;
const legalRecords = await request("/agreements?stage=legal_review", { token: legalToken });
assert(legalRecords.response.status === 200 && legalRecords.payload.length > 0, "Legal queue failed");
const legalAgreement = legalRecords.payload.find((item) => item.id === "agr-0041") || legalRecords.payload[0];
const openBlocking = (legalAgreement.legal_comments || []).find((item) => item.blocking && item.status !== "resolved");
if (openBlocking) {
  const resolved = await request(`/agreements/${legalAgreement.id}/legal-comments/${openBlocking.id}/resolve`, { token: legalToken, method: "POST", body: {} });
  assert(resolved.response.status === 200 && resolved.payload.status === "resolved", "Legal comment resolution failed");
}
const addedComment = await request(`/agreements/${legalAgreement.id}/legal-comments`, { token: legalToken, method: "POST", body: { clause: "Clause 12.1 — Notices", text: "Confirm the official notice addresses before execution.", blocking: false } });
assert(addedComment.response.status === 201, "Legal comment creation failed");
const legalApproval = await request(`/agreements/${legalAgreement.id}/actions/approve_legal`, { token: legalToken, method: "POST", body: {} });
assert(legalApproval.response.status === 200 && legalApproval.payload.stage === "dvc_endorsement" && legalApproval.payload.template.locked, "Legal approval and version lock failed");

const dvcToken = sessions.dvc.access_token;
const dvcEndorsement = await request(`/agreements/${legalAgreement.id}/actions/endorse_dvc`, { token: dvcToken, method: "POST", body: {} });
assert(dvcEndorsement.response.status === 200 && dvcEndorsement.payload.stage === "vc_submission", "DVC RPE endorsement failed");

const vcToken = sessions.vc_office.access_token;
const release = await request(`/agreements/${legalAgreement.id}/actions/release_vc`, { token: vcToken, method: "POST", body: {} });
assert(release.response.status === 200 && release.payload.stage === "signing", "VC package release failed");
const vcSigned = await request(`/agreements/${legalAgreement.id}/actions/record_vc_signature`, { token: vcToken, method: "POST", body: { date: "2026-08-10" } });
assert(vcSigned.response.status === 200 && vcSigned.payload.status === "awaiting_partner_signature", "VC signature tracking failed");
const partnerSigned = await request(`/agreements/${legalAgreement.id}/actions/record_partner_signature`, { token: vcToken, method: "POST", body: { date: "2026-08-11" } });
assert(partnerSigned.response.status === 200 && partnerSigned.payload.status === "fully_signed", "Partner signature tracking failed");
const signedUpload = await request(`/agreements/${legalAgreement.id}/actions/upload_signed`, { token: vcToken, method: "POST", body: { document: { name: "Final_Signed_Agreement.pdf", size: 4096, mime_type: "application/pdf" } } });
assert(signedUpload.response.status === 200 && signedUpload.payload.stage === "signed_upload" && signedUpload.payload.documents.some((item) => item.status === "final_signed"), "Final signed PDF workflow failed");

const activated = await request(`/agreements/${legalAgreement.id}/actions/activate`, { token: sessions.linkages.access_token, method: "POST", body: { effective_date: "2026-09-01", expiry_date: "2029-08-31", partner_liaison_name: "Anne Achieng", initial_deliverable: "Submit implementation work plan" } });
assert(activated.response.status === 200 && activated.payload.status === "active" && activated.payload.partner_liaison_name && activated.payload.initial_deliverables.length, "Activation checklist and transition failed");

const dvcRecords = await request("/agreements", { token: dvcToken });
assert(dvcRecords.response.status === 200, "DVC scoped agreement query failed");
const signingRecords = await request("/agreements", { token: vcToken });
assert(signingRecords.response.status === 200, "VC Office queue failed");

const notificationRecords = await request("/notifications", { token: sessions.linkages.access_token });
assert(notificationRecords.response.status === 200 && notificationRecords.payload.length > 0, "Notification centre failed");
const resend = await request(`/notifications/${notificationRecords.payload[0].id}/resend`, { token: sessions.linkages.access_token, method: "POST", body: {} });
assert(resend.response.status === 200 && resend.payload.email_status === "queued", "Notification resend failed");

const scoreList = await request("/scorecards", { token: sessions.me.access_token });
assert(scoreList.response.status === 200 && scoreList.payload.length > 0, "Scorecard list failed");
const recalculatedScore = await request(`/scorecards/${scoreList.payload[0].id}/recalculate`, { token: sessions.me.access_token, method: "POST", body: {} });
assert(recalculatedScore.response.status === 200 && Number.isFinite(recalculatedScore.payload.overall_score), "Scorecard recalculation failed");

const createdUser = await request("/users", { token: adminToken, method: "POST", body: { full_name: "Smoke Test User", email: "smoke.user@jkuat.ac.ke", password: "Temporary@123", role: "researcher", department: "Computing", faculty: "Computing and Information Technology" } });
assert(createdUser.response.status === 201 && createdUser.payload.role === "researcher" && !Object.hasOwn(createdUser.payload, "password"), "Administrator user creation failed");
const updatedUser = await request(`/users/${createdUser.payload.id}`, { token: adminToken, method: "PATCH", body: { is_active: false } });
assert(updatedUser.response.status === 200 && updatedUser.payload.is_active === false, "Administrator user update failed");

const templateCreate = await request("/templates", { token: adminToken, method: "POST", body: { agreement_type: "MoU", name: "Smoke Test Template", version: "1.0", description: "Automated contract test" } });
assert(templateCreate.response.status === 201 && templateCreate.payload.status === "draft", "Template creation failed");
const templatePublish = await request(`/templates/${templateCreate.payload.id}`, { token: adminToken, method: "PATCH", body: { status: "active", effective_date: "2026-08-05" } });
assert(templatePublish.response.status === 200 && templatePublish.payload.status === "active", "Template publication failed");

const meList = await request("/me/reports", { token: sessions.me.access_token });
assert(meList.response.status === 200 && meList.payload.length > 0, "M&E report list failed");
const meReport = meList.payload[0];
const submittedReport = await request(`/me/reports/${meReport.id}`, { token: sessions.me.access_token, method: "PATCH", body: { ...meReport, status: "submitted" } });
assert(submittedReport.response.status === 200 && submittedReport.payload.status === "submitted", "M&E report submission failed");
const returnedReport = await request(`/me/reports/${meReport.id}`, { token: sessions.linkages.access_token, method: "PATCH", body: { ...submittedReport.payload, status: "returned", review_note: "Attach the signed evidence register." } });
assert(returnedReport.response.status === 200 && returnedReport.payload.status === "returned" && returnedReport.payload.review_note, "M&E report return workflow failed");
const resubmittedReport = await request(`/me/reports/${meReport.id}`, { token: sessions.me.access_token, method: "PATCH", body: { ...returnedReport.payload, status: "submitted" } });
assert(resubmittedReport.response.status === 200 && resubmittedReport.payload.status === "submitted", "Returned M&E report resubmission failed");
const validatedReport = await request(`/me/reports/${meReport.id}`, { token: sessions.linkages.access_token, method: "PATCH", body: { ...resubmittedReport.payload, status: "validated" } });
assert(validatedReport.response.status === 200 && validatedReport.payload.status === "validated", "M&E report validation failed");

const reports = await request("/reports/portfolio", { token: sessions.executive.access_token });
assert(reports.response.status === 200 && reports.payload.totals, "Executive report failed");
const summary = await request("/reports/ai-summary", { token: sessions.executive.access_token, method: "POST", body: { date_range: "last_12_months" } });
assert(summary.response.status === 200 && summary.payload.disclaimer.includes("must be reviewed"), "AI summary lacks mandatory human-review disclaimer");
const approvedSummary = await request(`/reports/ai-summary/${summary.payload.id}/approve`, { token: sessions.executive.access_token, method: "POST", body: { narrative: `${summary.payload.narrative} Human reviewer note.` } });
assert(approvedSummary.response.status === 200 && approvedSummary.payload.status === "approved" && approvedSummary.payload.approved_by, "Human approval of AI-assisted report failed");
const pdfExport = await request("/reports/export.pdf", { token: sessions.executive.access_token });
assert(pdfExport.response.status === 200, "PDF report export contract failed");
const excelExport = await request("/reports/export.xlsx", { token: sessions.executive.access_token });
assert(excelExport.response.status === 200, "Excel report export contract failed");

const audit = await request("/audit", { token: sessions.auditor.access_token });
assert(audit.response.status === 200 && Array.isArray(audit.payload), "Auditor read-only workspace failed");
const forbiddenUsers = await request("/users", { token: researcherToken });
assert(forbiddenUsers.response.status === 403, "Researcher must not access administrative users endpoint");

console.log(`Accord360 mock smoke test passed for ${accounts.length} roles, the canonical Legal→DVC→VC→Signing→Activation flow, documents, reports, notifications and administration contracts.`);
