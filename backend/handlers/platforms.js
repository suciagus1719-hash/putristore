const { resolveServiceCatalog } = require("../utils/serviceCatalog");
const { guessPlatform } = require("../utils/serviceUtils");

const ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";

const FALLBACK = [
  "TikTok",
  "Twitter/X",
  "Instagram",
  "YouTube",
  "Facebook",
  "Telegram",
  "Shopee",
  "Other",
];

const normalizeList = (names) =>
  names.map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    name,
  }));

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  try {
    const snapshot = await resolveServiceCatalog({});
    const set = new Set();
    (snapshot.list || []).forEach((svc) => {
      const plat = svc.platform || guessPlatform(svc.name || svc.category || "");
      if (plat) set.add(plat);
    });
    const names = Array.from(set);
    return res.status(200).json(normalizeList(names.length ? names : FALLBACK));
  } catch (err) {
    console.warn("[platforms] fallback:", err.message);
    return res.status(200).json(normalizeList(FALLBACK));
  }
};
