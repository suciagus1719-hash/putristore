const fs = require("fs");
const path = require("path");
const fetch = global.fetch || require("node-fetch");
const { mapService } = require("./serviceUtils");

let kvClient = null;
try {
  ({ kv: kvClient } = require("@vercel/kv"));
} catch (err) {
  kvClient = null;
}

const CACHE_KEY = "__service_catalog_v1";
const DATA_DIR = path.join(__dirname, "..", "data");
const CACHE_FILE = path.join(DATA_DIR, "services-cache.json");
const MANUAL_FILE = path.join(DATA_DIR, "services.manual.json");
const CACHE_TTL_MS = Number(process.env.SERVICES_CACHE_TTL_MS || 5 * 60 * 1000);

const PANEL_URLS = Array.from(
  new Set(
    [
      process.env.SMMPANEL_BASE_URL,
      process.env.SMMPANEL_ALT_URL,
      process.env.SMMPANEL_PROXY_URL,
      process.env.SMMPANEL_GATEWAY_URL,
    ]
      .filter((value) => typeof value === "string" && value.trim().length)
      .map((value) => value.trim())
  )
);

const PANEL_KEY = process.env.SMMPANEL_API_KEY || process.env.PANEL_KEY || "";
const PANEL_SECRET = process.env.SMMPANEL_SECRET || process.env.PANEL_SECRET || "";

async function fetchPanelServices() {
  if (!PANEL_KEY) {
    const error = new Error("SMMPANEL_API_KEY belum diset");
    error.code = "PANEL_CONFIG";
    throw error;
  }
  if (!PANEL_URLS.length) {
    const error = new Error("SMMPANEL_BASE_URL belum diset");
    error.code = "PANEL_CONFIG";
    throw error;
  }

  if (lastPanelFailure && Date.now() - lastPanelFailure < PANEL_FAILURE_COOLDOWN_MS) {
    const error = new Error("Panel masih tidak merespons (menunggu sebelum mencoba ulang)");
    error.code = "PANEL_UNREACHABLE";
    throw error;
  }

  const errors = [];
  const form = new URLSearchParams({ api_key: PANEL_KEY, action: "services" });
  if (PANEL_SECRET) form.set("secret_key", PANEL_SECRET);
  const body = form.toString();

  for (const url of PANEL_URLS) {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutMs = Number(process.env.SERVICES_FETCH_TIMEOUT_MS || 7000);
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      let resp;
      try {
        resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "putristore-backend/1.1",
        },
        body,
        signal: controller?.signal,
      });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const text = await resp.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        errors.push({ url, status: resp.status, ok: resp.ok, error: "invalid_json", snippet: text.slice(0, 200) });
        continue;
      }

      const rawList = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
      if (!resp.ok || !rawList.length) {
        errors.push({
          url,
          status: resp.status,
          ok: resp.ok,
          error: parsed?.error || parsed?.data?.msg || "empty_response",
        });
        continue;
      }
      lastPanelFailure = 0;
      return {
        list: rawList.map((svc) => mapService(svc)),
        meta: { source: "panel", url },
      };
    } catch (err) {
      errors.push({ url, error: err.message });
    }
  }

  const error = new Error("Panel layanan tidak merespons");
  error.code = "PANEL_UNREACHABLE";
  error.attempts = errors;
  lastPanelFailure = Date.now();
  throw error;
}

async function persistCatalog(list, meta = {}) {
  const payload = {
    list,
    meta: {
      ...meta,
      cached_at: new Date().toISOString(),
    },
  };
  if (kvClient) {
    try {
      await kvClient.set(CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("[serviceCatalog] gagal menyimpan cache ke KV:", err.message);
    }
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // optional local cache
  }
  return payload;
}

async function readCachedCatalog() {
  if (kvClient) {
    try {
      const raw = await kvClient.get(CACHE_KEY);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed?.list?.length) return parsed;
      }
    } catch {
      // ignore
    }
  }
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (parsed?.list?.length) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function readManualCatalog() {
  try {
    if (!fs.existsSync(MANUAL_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(MANUAL_FILE, "utf8"));
    if (Array.isArray(raw?.list)) return raw;
    if (Array.isArray(raw)) {
      return {
        list: raw.map((svc) => mapService(svc)),
        meta: { source: "manual-file", cached_at: new Date().toISOString() },
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function resolveServiceCatalog({ forceRefresh = false } = {}) {
  let snapshot = await readCachedCatalog();
  const now = Date.now();
  const cachedAt = snapshot?.meta?.cached_at ? Date.parse(snapshot.meta.cached_at) : 0;
  const cacheExpired = !snapshot || !cachedAt || now - cachedAt > CACHE_TTL_MS;
  let lastError = null;

  if (forceRefresh || cacheExpired) {
    try {
      const fresh = await fetchPanelServices();
      snapshot = await persistCatalog(fresh.list, fresh.meta);
      return snapshot;
    } catch (err) {
      lastError = err;
    }
  } else if (snapshot) {
    return snapshot;
  }

  if (snapshot?.list?.length) {
    snapshot.meta = {
      ...(snapshot.meta || {}),
      warning: lastError?.message,
      attempts: lastError?.attempts,
      source: snapshot.meta?.source || "cache",
    };
    return snapshot;
  }

  const manual = readManualCatalog();
  if (manual?.list?.length) return manual;

  if (lastError) throw lastError;
  const fallbackError = new Error("Service catalog kosong. Sinkronkan layanan melalui endpoint admin.");
  fallbackError.code = "CATALOG_EMPTY";
  throw fallbackError;
}

async function forceRefreshCatalog() {
  const fresh = await fetchPanelServices();
  return persistCatalog(fresh.list, fresh.meta);
}

async function saveManualCatalog(list, meta = {}) {
  if (!Array.isArray(list) || !list.length) {
    const error = new Error("services harus berupa array dan tidak boleh kosong");
    error.code = "INVALID_INPUT";
    throw error;
  }
  const normalized = list.map((svc) => mapService(svc));
  return persistCatalog(normalized, { ...meta, source: meta.source || "manual-upload" });
}

module.exports = {
  resolveServiceCatalog,
  forceRefreshCatalog,
  saveManualCatalog,
  readCachedCatalog,
  readManualCatalog,
};
let lastPanelFailure = 0;
const PANEL_FAILURE_COOLDOWN_MS = Number(process.env.SERVICES_FAILURE_COOLDOWN_MS || 60000);
