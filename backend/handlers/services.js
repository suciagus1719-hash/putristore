// backend/api/services.js
// Layanan diambil dari cache agar tetap tampil ketika panel utama error 522.

const { resolveServiceCatalog } = require("../utils/serviceCatalog");
const { guessPlatform, matchAction } = require("../utils/serviceUtils");

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Use GET" });

  const platform = String(req.query.platform || "").trim();
  const action = String(req.query.action || "").trim();
  const refreshFlag = String(req.query.refresh || "").toLowerCase();
  const forceRefresh = ["1", "true", "yes"].includes(refreshFlag);

  try {
    const snapshot = await resolveServiceCatalog({ forceRefresh });
    res.setHeader("X-Service-Source", snapshot.meta?.source || "cache");
    if (snapshot.meta?.cached_at) res.setHeader("X-Service-Updated-At", snapshot.meta.cached_at);
    if (snapshot.meta?.warning) res.setHeader("X-Service-Warning", snapshot.meta.warning);

    let list = snapshot.list || [];

    if (platform) {
      list = list.filter((svc) => {
        const guessed = svc.platform || guessPlatform(svc.name || svc.category || "");
        return guessed === platform;
      });
    }
    if (action) {
      list = list.filter((svc) => matchAction(svc.category || svc.action || "", action));
    }

    if (!list.length && platform) {
      list = (snapshot.list || [])
        .filter((svc) => {
          const guessed = svc.platform || guessPlatform(svc.name || svc.category || "");
          return guessed === platform;
        })
        .slice(0, 20);
    }

    return res.status(200).json(list);
  } catch (err) {
    console.warn("[services] gagal memuat catalog:", err.message);
    res.setHeader("X-Service-Error", err.message || "catalog_error");
    return res.status(200).json([]);
  }
};
