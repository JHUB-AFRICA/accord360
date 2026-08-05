import { mockRequest } from "./mockApi.js";

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
export const USE_MOCK_API = String(import.meta.env.VITE_USE_MOCK_API || "false").toLowerCase() === "true";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem("accord360_token");
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = USE_MOCK_API
    ? await mockRequest(path, { ...options, headers })
    : await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem("accord360_token");
    localStorage.removeItem("accord360_user");
    window.dispatchEvent(new CustomEvent("accord360:unauthorized"));
  }

  if (!response.ok) {
    let payload = null;
    let message = `Request failed (${response.status})`;
    try {
      payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch {
      const body = await response.text();
      if (body) message = body;
    }
    throw new ApiError(message, response.status, payload);
  }
  return response;
}

export async function api(path, options = {}) {
  const response = await request(path, options);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/csv") || contentType.includes("application/octet-stream") || contentType.includes("application/pdf")) return response.blob();
  return response.status === 204 ? null : response.json();
}

export async function downloadFile(path, fallbackName = "download") {
  const response = await request(path);
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basicName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = decodeURIComponent(utf8Name || basicName || fallbackName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function apiJson(path, method, body) {
  return api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}
