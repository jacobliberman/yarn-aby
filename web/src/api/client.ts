const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, "")}${p}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
  getToken?: () => Promise<string | null>,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return fetch(apiUrl(path), { ...init, headers });
}
