const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export async function api(path, options = {}) {
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
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/csv") || contentType.includes("application/octet-stream") || response.headers.get("content-disposition")) return response.blob();
  return response.status === 204 ? null : response.json();
}

export { API_URL };
