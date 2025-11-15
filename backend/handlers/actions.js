// GET /api/actions?platform=Facebook – daftar kategori/aksi yang tersedia untuk platform tertentu.

const { resolveServiceCatalog } = require("../utils/serviceCatalog");
const { guessPlatform, normalizeActionLabel, FALLBACK_ACTIONS } = require("../utils/serviceUtils");

const ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const platform = String(req.query.platform || "").trim();
  if (!platform) return res.status(200).json(FALLBACK_ACTIONS);

  try {
    const snapshot = await resolveServiceCatalog({});
    const set = new Set();
    (snapshot.list || []).forEach((svc) => {
      const plat = svc.platform || guessPlatform(svc.name || svc.category || "");
      if (plat !== platform) return;
      set.add(svc.action || normalizeActionLabel(svc.category || svc.name || ""));
    });
    const out = Array.from(set);
    out.sort((a, b) => (FALLBACK_ACTIONS.indexOf(a) + 999) - (FALLBACK_ACTIONS.indexOf(b) + 999));
    return res.status(200).json(out.length ? out : FALLBACK_ACTIONS);
  } catch (err) {
    console.warn("[actions] gagal baca catalog:", err.message);
    return res.status(200).json(FALLBACK_ACTIONS);
  }
};
