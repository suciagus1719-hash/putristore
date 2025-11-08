// GET /api/services?platform=Facebook&action=Likes
// Ambil semua layanan -> filter fuzzy berdasarkan platform & kategori -> map ke schema UI.

const ORIGIN = "https://suciagus1719-hash.github.io";

function guessPlatform(s = "") {
  const n = String(s).toLowerCase();
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("youtube")) return "YouTube";
  if (n.includes("facebook")) return "Facebook";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("twitter") || n.includes("x")) return "Twitter/X";
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return "Shopee";
  return "Other";
}

const contains = (a = "", b = "") => String(a).toLowerCase().includes(String(b).toLowerCase());

const ACTION_SYNONYMS = {
  Followers: ["follow","subscriber","sub"],
  Likes: ["like","page like","post like","photo like","reactions like"],
  Views: ["view","watch","plays"],
  Comments: ["comment"],
  Shares: ["share"],
  Subscribers: ["subscriber","sub"],
  Members: ["member"],
  Reactions: ["reaction"],
};

function matchAction(cat = "", action = "") {
  if (!action) return true;
  const c = String(cat).toLowerCase();
  const a = String(action).toLowerCase();
  if (contains(c, a) || contains(a, c)) return true;
  const syn = ACTION_SYNONYMS[action] || [];
  return syn.some(k => c.includes(k));
}

function mapService(s, platform="", action="") {
  return {
    provider_service_id: s?.id ?? s?.service ?? s?.service_id ?? s?.provider_service_id,
    name: s?.name || `${platform} ${action}`.trim(),
    min: Number(s?.min ?? s?.min_qty ?? 1),
    max: Number(s?.max ?? s?.max_qty ?? 100000),
    // Dok: field harga = `price` (anggap per 1k). :contentReference[oaicite:2]{index=2}
    rate_per_1k: Number(s?.price ?? s?.rate ?? s?.price_per_1000 ?? 0),
    description: s?.note || s?.description || "",
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
    if (!API || !KEY || !SEC) return res.status(200).json([]);

    const body = new URLSearchParams({ api_key: KEY, secret_key: SEC, action: "services" });
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body
    });
    const text = await r.text();

    let payload; try { payload = JSON.parse(text); } catch { payload = {}; }
    const list = Array.isArray(payload?.data) ? payload.data : []; // pakai data[] dari dok. :contentReference[oaicite:3]{index=3}

    // 1) filter platform
    let filtered = list.filter(s => guessPlatform(s?.name || s?.category || "") === platform);

    // 2) filter kategori (longgar) kalau user pilih action
    if (action) filtered = filtered.filter(s => matchAction(s?.category || "", action));

    // 3) fallback: kalau kosong, ambil 20 pertama untuk platform tsb
    if (filtered.length === 0) {
      filtered = list.filter(s => guessPlatform(s?.name || s?.category || "") === platform).slice(0, 20);
    }

    return res.status(200).json(filtered.map(s => mapService(s, platform, action)));
  } catch {
    return res.status(200).json([]); // tetap 200 supaya UI tidak crash
  }
}
