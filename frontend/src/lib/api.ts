const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: customHeaders, ...restOptions } = options || {};
  const authHeaders: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("bru_movements_token");
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...customHeaders,
    },
    ...restOptions,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("bru_movements_token");
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function apiFetchBlob(path: string): Promise<string | null> {
  const authHeaders: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("bru_movements_token");
    if (token) authHeaders["Authorization"] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
