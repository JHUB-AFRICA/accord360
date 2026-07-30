const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("accord360_token");
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("accord360_token");
    localStorage.removeItem("accord360_user");
  }
  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }
  return response;
}

export async function api(path, options = {}) {
  const response = await request(path, options);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/csv") || contentType.includes("application/octet-stream")) return response.blob();
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

export { API_URL };
