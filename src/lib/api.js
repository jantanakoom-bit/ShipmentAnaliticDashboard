export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function apiRequest(path, options = {}) {
  const normalizedPath = API_BASE_URL.endsWith("/api") && path.startsWith("/api/")
    ? path.slice(4)
    : path;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.error || `Request failed: ${response.status}`);
  }

  return body;
}
