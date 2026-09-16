import { api, downloadFile } from "./api.js";
import {
  normalizeAgreementDetail,
  normalizeAgreementList,
  normalizeAudit,
  normalizeDashboard,
  normalizeNotification,
  normalizePartner,
  normalizeUser
} from "./normalize.js";

export const BACKEND_CAPABILITIES = Object.freeze({
  authentication: true,
  users: true,
  champions: true,
  partners: true,
  agreements: true,
  workflowTransitions: true,
  documents: true,
  monitoring: true,
  dashboard: true,
  notifications: true,
  csvReports: true,
  audit: true,
  partnerApplications: true,
  corrections: true,
  partnerReviewHistory: true,
  partnerAccounts: true,
  passwordReset: false,
  templates: true,
  configuration: true,
  referenceData: true,
  dedicatedCorrections: true,
  scorecards: true,
  aiReports: false,
  pdfReports: true,
  excelReports: true,
  portfolioReports: true,
  historicalDataReview: true
});

function cleanParams(params = {}) {
  const output = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") output.set(key, String(value));
  });
  return output.toString();
}

export async function loginRequest(email, password) {
  const response = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return { ...response, user: normalizeUser(response.user) };
}

export async function registerPartnerApplication(payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === "documents") return;
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  (payload.documents || []).forEach((file) => formData.append("files", file));
  return api("/auth/register-partner", { method: "POST", body: formData });
}

export async function getCurrentUser() {
  return normalizeUser(await api("/auth/me"));
}

export async function getDashboard() {
  const [workspace, stats] = await Promise.all([api("/dashboard/workspace"), api("/dashboard/stats")]);
  return normalizeDashboard(workspace, stats);
}

export async function listUsers() {
  return (await api("/users")).map(normalizeUser);
}

export async function listChampions() {
  return (await api("/users/champions")).map(normalizeUser);
}

export async function createUser(payload) {
  return normalizeUser(await api("/users", { method: "POST", body: JSON.stringify(payload) }));
}

export async function updateUser(id, payload) {
  return normalizeUser(await api(`/users/${Number(id)}`, { method: "PATCH", body: JSON.stringify(payload) }));
}

export async function listPartners() {
  return (await api("/partners")).map(normalizePartner);
}

export async function getPartner(id) {
  const partners = await listPartners();
  return partners.find((partner) => Number(partner.id) === Number(id)) || null;
}

export async function createPartner(payload) {
  return normalizePartner(await api("/partners", { method: "POST", body: JSON.stringify(payload) }));
}

export async function updatePartner(id, payload) {
  return normalizePartner(await api(`/partners/${Number(id)}`, { method: "PUT", body: JSON.stringify(payload) }));
}

export async function listPartnerReviews(id) {
  return api(`/partners/${Number(id)}/reviews`);
}

export async function reviewPartner(id, status, reason) {
  return api(`/partners/${Number(id)}/review`, { method: "POST", body: JSON.stringify({ status, reason }) });
}

export async function listTemplates({ agreementType = "", includeArchived = false } = {}) {
  const query = cleanParams({ agreement_type: agreementType, include_archived: includeArchived ? "true" : undefined });
  return api(`/templates${query ? `?${query}` : ""}`);
}

export async function createTemplate(payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => { if (value !== undefined && value !== null) formData.append(key, value); });
  return api("/templates", { method: "POST", body: formData });
}

export async function updateTemplate(id, payload) {
  return api(`/templates/${Number(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function downloadTemplate(id, fallbackName = "template") {
  return downloadFile(`/templates/${Number(id)}/download`, fallbackName);
}

export async function listConfiguration() {
  return api("/configuration");
}

export async function createConfiguration(payload) {
  return api("/configuration", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateConfiguration(key, payload) {
  return api(`/configuration/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function listReferenceData(category = "") {
  const query = cleanParams({ category });
  return api(`/reference-data${query ? `?${query}` : ""}`);
}

export async function createReferenceData(payload) {
  return api("/reference-data", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateReferenceData(id, payload) {
  return api(`/reference-data/${Number(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function acceptPartnerInvitation(token, password) {
  return api(`/auth/partner-invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: JSON.stringify({ password }) });
}

export async function invitePartnerUser(partnerId, payload) {
  return api(`/partners/${Number(partnerId)}/invitations`, { method: "POST", body: JSON.stringify(payload) });
}

export async function getPartnerWorkspace() {
  return api("/partner/me");
}

export async function listPartnerAgreements() {
  return api("/partner/agreements");
}

export async function getPartnerAgreement(id) {
  return api(`/partner/agreements/${Number(id)}`);
}

export async function downloadPartnerDocument(agreementId, documentId, fallbackName = "partner-document") {
  return downloadFile(`/partner/agreements/${Number(agreementId)}/documents/${Number(documentId)}/download`, fallbackName);
}

export async function listAgreements(filters = {}) {
  const query = cleanParams(filters);
  const records = await api(`/agreements${query ? `?${query}` : ""}`);
  return records.map(normalizeAgreementList);
}

export async function createAgreement(payload) {
  return normalizeAgreementDetail(await api("/agreements", { method: "POST", body: JSON.stringify(payload) }));
}

export async function getAgreement(id) {
  return normalizeAgreementDetail(await api(`/agreements/${Number(id)}`));
}

export async function listScorecards() {
  return api("/scorecards");
}

export async function recalculateScorecard(agreementId) {
  return api(`/scorecards/${Number(agreementId)}/recalculate`, { method: "POST" });
}

export async function listScorecardHistory(agreementId) {
  return api(`/scorecards/${Number(agreementId)}/history`);
}

export async function listScorecardDefinitions() {
  return api("/scorecards/definitions");
}

export async function createScorecardDefinition(payload) {
  return api("/scorecards/definitions", { method: "POST", body: JSON.stringify(payload) });
}

export async function getHistoricalReviewSummary() {
  return api("/data-review/summary");
}

export async function listHistoricalReviews(status = "pending_review") {
  return api(`/data-review?status=${encodeURIComponent(status)}`);
}

export async function getHistoricalReview(id) {
  return api(`/data-review/${Number(id)}`);
}

export async function updateHistoricalReview(id, payload) {
  return api(`/data-review/${Number(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function verifyHistoricalReview(id, review_notes = null) {
  return api(`/data-review/${Number(id)}/verify`, { method: "POST", body: JSON.stringify({ review_notes }) });
}

export async function updateAgreement(id, payload) {
  return normalizeAgreementDetail(await api(`/agreements/${Number(id)}`, { method: "PATCH", body: JSON.stringify(payload) }));
}

export async function transitionAgreement(id, action, comment = null, extra = {}) {
  return normalizeAgreementDetail(await api(`/agreements/${Number(id)}/transition`, {
    method: "POST",
    body: JSON.stringify({ action, comment: comment || null, ...extra })
  }));
}

export async function listCorrections() {
  return api("/corrections");
}

export async function getCorrection(id) {
  return api(`/corrections/${Number(id)}`);
}

export async function respondCorrection(id, responseText) {
  return api(`/corrections/${Number(id)}/respond`, { method: "POST", body: JSON.stringify({ response_text: responseText }) });
}

export async function resolveCorrection(id, resolutionNotes) {
  return api(`/corrections/${Number(id)}/resolve`, { method: "POST", body: JSON.stringify({ resolution_notes: resolutionNotes }) });
}

export async function uploadAgreementDocument(id, { file, documentType = "supporting", version = "1.0", confidentiality = "internal", isOfficial = false }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  formData.append("version", version);
  formData.append("confidentiality", confidentiality);
  formData.append("is_official", String(Boolean(isOfficial)));
  return api(`/agreements/${Number(id)}/documents`, { method: "POST", body: formData });
}

export async function downloadAgreementDocument(agreementId, documentId, fallbackName) {
  return downloadFile(`/agreements/${Number(agreementId)}/documents/${Number(documentId)}/download`, fallbackName);
}

export async function createDeliverable(agreementId, payload) {
  return api(`/agreements/${Number(agreementId)}/deliverables`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateDeliverable(agreementId, deliverableId, payload) {
  return api(`/agreements/${Number(agreementId)}/deliverables/${Number(deliverableId)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function createValueRecord(agreementId, payload) {
  return api(`/agreements/${Number(agreementId)}/values`, { method: "POST", body: JSON.stringify(payload) });
}

export async function listNotifications() {
  return (await api("/notifications")).map(normalizeNotification);
}

export async function markNotificationRead(id) {
  return normalizeNotification(await api(`/notifications/${Number(id)}/read`, { method: "POST" }));
}

export async function exportAgreementsCsv(filters = {}) {
  const query = cleanParams(filters);
  return downloadFile(`/reports/agreements.csv${query ? `?${query}` : ""}`, "accord360-agreements.csv");
}

export async function getPortfolioReport(filters = {}) {
  const query = cleanParams(filters);
  return api(`/reports/portfolio${query ? `?${query}` : ""}`);
}

export async function exportPortfolioPdf(filters = {}) {
  const query = cleanParams(filters);
  return downloadFile(`/reports/export.pdf${query ? `?${query}` : ""}`, "accord360-portfolio.pdf");
}

export async function exportPortfolioExcel(filters = {}) {
  const query = cleanParams(filters);
  return downloadFile(`/reports/export.xlsx${query ? `?${query}` : ""}`, "accord360-portfolio.xlsx");
}

export async function generatePortfolioSummary(filters = {}) {
  return api("/reports/ai-summary", { method: "POST", body: JSON.stringify(filters) });
}

export async function listAudit(limit = 100) {
  return (await api(`/reports/audit?limit=${Math.min(500, Math.max(1, Number(limit) || 100))}`)).map(normalizeAudit);
}
