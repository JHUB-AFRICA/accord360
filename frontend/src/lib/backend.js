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
  partnerAccounts: false,
  passwordReset: false,
  templates: false,
  configuration: false,
  dedicatedCorrections: false,
  scorecards: false,
  aiReports: false,
  pdfReports: false,
  excelReports: false
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

export async function updateAgreement(id, payload) {
  return normalizeAgreementDetail(await api(`/agreements/${Number(id)}`, { method: "PATCH", body: JSON.stringify(payload) }));
}

export async function transitionAgreement(id, action, comment = null) {
  return normalizeAgreementDetail(await api(`/agreements/${Number(id)}/transition`, {
    method: "POST",
    body: JSON.stringify({ action, comment: comment || null })
  }));
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

export async function listAudit(limit = 100) {
  return (await api(`/reports/audit?limit=${Math.min(500, Math.max(1, Number(limit) || 100))}`)).map(normalizeAudit);
}
