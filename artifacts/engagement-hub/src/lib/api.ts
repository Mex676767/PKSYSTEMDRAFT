const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() ?? "";
const API_BASE = configuredApiUrl.replace(/\/$/, "");

export function apiAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const storagePrefix = "/storage/v1/object/public/post-images/";
      const storageIndex = url.pathname.indexOf(storagePrefix);
      if (storageIndex >= 0) {
        const key = url.pathname.slice(storageIndex + storagePrefix.length);
        // Existing Storage object keys can contain nested paths (for example,
        // owner/avatar.jpg/<object-id>). Send every object from this bucket to
        // the DigitalOcean file API; it validates each path segment and never
        // falls back to the old Supabase URL.
        return `${API_BASE}/api/files/${key}${url.search}`;
      }
      if (url.pathname.startsWith("/api/files/")) return `${API_BASE}${url.pathname}${url.search}`;
    } catch {
      return path;
    }
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath.startsWith("/api/files/")) return `${API_BASE}${normalizedPath}`;
  return `${API_BASE}/api${normalizedPath}`;
}

export async function uploadImage(path: string, file: File): Promise<{ path: string; url: string; content_type: string }> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE}/api${normalizedPath}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
    credentials: "include",
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try { const body: unknown = await response.json(); if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") message = body.error; } catch { /* Keep the status message. */ }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<{ path: string; url: string; content_type: string }>;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}/api${normalizedPath}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") message = body.error;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
