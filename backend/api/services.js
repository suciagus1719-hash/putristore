// GET /api/services?platform=Facebook&action=Likes
// Lebih toleran: fuzzy match + fallback "ambil 20 layanan pertama" jika hasil kosong.

const ORIGIN = "https://suciagus1719-hash.github.io";

function guessPlatform(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("youtube")) return "YouTube";
  if (n.includes("facebook")) return "Facebook";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("twitter") || n.includes("x")) return "Twitter/X";
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return "Shopee";
  return "Other";
}

const contains = (a = "", b = "") =>
  String(a).toLowerCase().includes(String(b).toLowerCase());

// sinonim kategori umum → biar “Likes” ketemu “Page Likes”, “Post Likes”, dll.
const ACTION_SYNONYMS = {
  Followers: ["follow", "subscriber", "sub"],
  Likes: ["like", "page like", "post like", "photo like", "reactions like"],
  Views: ["view", "plays", "watch"],
  Comments: ["comment"],
  Shares: ["share"],
  Subscribers: ["subscriber", "sub"],
  Members: ["member"],
  Reactions: ["reaction"],
};

function matchAction(cat = "", action = "") {
  if (!action) return true; // kalau user belum pilih kategori → lolos
  const c = String(cat).toLowerCase();
  const a = String(action).toLowerCase();
  if (contains(c, a) || contains(a, c)) return true;
  const synonyms = ACTION_SYNONYMS[action] || [];
  return synonyms.some((k) => c.includes(k));
}

function mapService(s, platform = "", action = "") {
  return {
    provider_service_id: s?.service_id || s?.id || s?.service || s?.provider_service_id,
    name: s?.name || s?.service_name || `${platform} ${action}`.trim(),
    min: Number(s?.min || s?.min_qty || 1),
    max: Number(s?.max || s?.max_qty || 100000),
    rate_per_1k: Number(s?.rate_per_1k || s?.price_per_1000 || s?.rate || 0),
    description: s?.description || "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const platform = String(req.query.platform || "").trim();
  const action   = String(req.query.action   || "").trim();

  try {
    const API = process.env.SMMPANEL_BASE_URL;
    const KEY = process.env.SMMPANEL_API_KEY;
    const SEC = process.env.SMMPANEL_SECRET;
    if (!API || !KEY || !SEC) return res.status(200).json([]); // biar UI tidak crash

    const form = new URLSearchParams({ api_key: KEY, secret_key: SEC, action: "services" });
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });

    const text = await r.text();
    let list;
    try { list = JSON.parse(text); } catch { list = []; }
    if (!Array.isArray(list)) list = [];

    // 1) filter menurut platform (harus cocok)
    let filtered = list.filter((s) => guessPlatform(s?.name || s?.category || "") === platform);

    // 2) filter menurut action (fuzzy + sinonim). Bila kosong → lewati.
    if (action) filtered = filtered.filter((s) => matchAction(s?.category || s?.type || "", action));

    // 3) Jika kosong, fallback: ambil 20 layanan pertama untuk platform tsb (tanpa filter action)
    if (filtered.length === 0) {
      const onlyPlatform = list.filter((s) => guessPlatform(s?.name || s?.category || "") === platform);
      filtered = onlyPlatform.slice(0, 20);
    }

    // 4) map ke format UI
    const out = filtered.map((s) => mapService(s, platform, action));

    return res.status(200).json(out);
  } catch {
    return res.status(200).json([]); // jangan 500; biar UI tampil "Tidak ada layanan..."
  }
}
