const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, "")}${p}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = import.meta.env.VITE_API_KEY;
  const headers = new Headers(init?.headers);
  if (key && !headers.has("x-api-key")) {
    headers.set("x-api-key", key);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
