const FALLBACK_API = "https://putristore-backend.vercel.app";
const envCandidates = [
  import.meta.env?.VITE_API_URL,
  import.meta.env?.VITE_API_BASE,
  import.meta.env?.VITE_API,
  import.meta.env?.VITE_BACKEND_URL,
];

const resolveBase = () => {
  for (const candidate of envCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().replace(/\/+$/, "");
    }
  }
  return FALLBACK_API;
};

export const API_BASE = resolveBase();

export function buildApiUrl(path = "") {
  const target = String(path || "");
  if (/^https?:\/\//i.test(target)) return target;
  const suffix = target.startsWith("/") ? target : `/${target}`;
  return `${API_BASE}${suffix}`;
}

export async function apiJson(path, opts = {}) {
  const res = await fetch(buildApiUrl(path), opts);
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
  } catch {
    return { ok: res.ok, status: res.status, data: null, raw: text };
  }
}

export function saveUser(user) {
  localStorage.setItem("user", JSON.stringify(user || null));
}

export function getUser() {
  const raw = localStorage.getItem("user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem("user");
}
