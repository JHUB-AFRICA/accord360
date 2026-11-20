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
  researchers: true,
  partners: true,
  agreements: true,
  workflowTransitions: true,
  documents: true,
  monitoring: true,
  dashboard: true,
  notifications: true,
  csvReports: true,
  audit: true,
  corrections: true,
  partnerReviewHistory: true,
  passwordReset: false,
  templates: true,
  configuration: true,
  referenceData: true,
  dedicatedCorrections: true,
  scorecards: true,
  aiReports: false,
  pdfReports: false,
  excelReports: false,
  portfolioReports: true,
  historicalDataReview: false
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

export async function getAuthConfig() {
  return api("/auth/config");
}

export async function signupRequest({ email, password, role, department }) {
  const response = await api("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, role, department: department || null }) });
  return { ...response, user: normalizeUser(response.user) };
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

export async function listResearchers() {
  return (await api("/users/researchers")).map(normalizeUser);
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

export async function listTemplates({ documentType = "", agreementType = "", includeArchived = false } = {}) {
  const query = cleanParams({ document_type: documentType || agreementType, include_archived: includeArchived ? "true" : undefined });
  return api(`/templates${query ? `?${query}` : ""}`);
}

export async function listFieldDefinitions() {
  return api("/templates/fields");
}

export async function createTemplate(payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => { if (value !== undefined && value !== null) formData.append(key, value); });
  return api("/templates", { method: "POST", body: formData });
}

export async function downloadTemplate(id, fallbackName = "template") {
  return downloadFile(`/templates/${Number(id)}/download`, fallbackName);
}

export async function activateTemplate(id) {
  return api(`/templates/${Number(id)}/activate`, { method: "POST" });
}

export async function deactivateTemplate(id) {
  return api(`/templates/${Number(id)}/deactivate`, { method: "POST" });
}

export async function createProgressUpdate(agreementId, payload) {
  return api(`/agreements/${Number(agreementId)}/progress-updates`, { method: "POST", body: JSON.stringify(payload) });
}

export async function listProgressUpdates(agreementId = null) {
  const query = cleanParams({ agreement_id: agreementId ? Number(agreementId) : undefined });
  return api(`/progress-updates${query ? `?${query}` : ""}`);
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

export async function getDriveAccessStatus(agreementId) {
  return api(`/agreements/${Number(agreementId)}/drive-access`);
}

export async function reconcileDriveAccess(agreementId) {
  return api(`/agreements/${Number(agreementId)}/drive-access/reconcile`, { method: "POST" });
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

export async function uploadAgreementDraft(id, file) {
  const formData = new FormData();
  formData.append("file", file);
  return normalizeAgreementDetail(await api(`/agreements/${Number(id)}/versions`, { method: "POST", body: formData }));
}

export async function downloadSigningCopy(agreementId, format) {
  const normalizedFormat = String(format).toLowerCase();
  if (!["pdf", "docx"].includes(normalizedFormat)) throw new Error("Signing copy format must be PDF or Word.");
  return downloadFile(`/agreements/${Number(agreementId)}/signing-copy?format=${normalizedFormat}`, `agreement-${Number(agreementId)}-signing-copy.${normalizedFormat}`);
}

export async function downloadAgreementVersion(agreementId, versionId, fallbackName = "agreement-version.docx") {
  return downloadFile(`/agreements/${Number(agreementId)}/versions/${Number(versionId)}/download`, fallbackName);
}

export async function listVersionComments(versionId) {
  return api(`/versions/${Number(versionId)}/comments`);
}

export async function createVersionComment(versionId, payload) {
  return api(`/versions/${Number(versionId)}/comments`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateVersionComment(commentId, status) {
  return api(`/comments/${Number(commentId)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function listNotifications({ limit = 20, cursor, unreadOnly = false, category } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (unreadOnly) params.set("unread_only", "true");
  if (category) params.set("category", category);
  const payload = await api(`/notifications?${params.toString()}`);
  // Keep a small compatibility bridge while mock mode catches up to the envelope.
  const items = Array.isArray(payload) ? payload : (payload?.items || []);
  return { items: items.map(normalizeNotification), next_cursor: Array.isArray(payload) ? null : (payload?.next_cursor || null) };
}

export async function getUnreadNotificationCount() {
  const payload = await api("/notifications/unread-count");
  return Number(payload?.count || 0);
}

export async function markNotificationRead(id) {
  return normalizeNotification(await api(`/notifications/${Number(id)}/read`, { method: "POST" }));
}

export async function markNotificationUnread(id) {
  return normalizeNotification(await api(`/notifications/${Number(id)}/unread`, { method: "POST" }));
}

export async function markAllNotificationsRead() {
  return api("/notifications/read-all", { method: "POST" });
}

export async function exportAgreementsCsv(filters = {}) {
  const query = cleanParams(filters);
  return downloadFile(`/reports/agreements.csv${query ? `?${query}` : ""}`, "accord360-agreements.csv");
}

export async function getPortfolioReport(filters = {}) {
  const query = cleanParams(filters);
  return api(`/reports/portfolio${query ? `?${query}` : ""}`);
}

export async function listAudit(limit = 100) {
  return (await api(`/reports/audit?limit=${Math.min(500, Math.max(1, Number(limit) || 100))}`)).map(normalizeAudit);
}
