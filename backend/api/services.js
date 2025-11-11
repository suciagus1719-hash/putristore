// backend/api/services.js
// GET /api/services?platform=Instagram&action=Followers
// Ambil daftar layanan dari panel SMM, lalu filter dan map untuk UI.

// CORS
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

// ENV panel
const PANEL_URL = process.env.SMMPANEL_BASE_URL || "https://pusatpanelsmm.com/api/json.php";
const PANEL_KEY = process.env.SMMPANEL_API_KEY || process.env.PANEL_KEY;
const PANEL_SECRET = process.env.SMMPANEL_SECRET || process.env.PANEL_SECRET;

// --- Utils kecil untuk klasifikasi & filter longgar ---
function guessPlatform(s = "") {
  const n = String(s).toLowerCase();
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("youtube")) return "YouTube";
  if (n.includes("facebook")) return "Facebook";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("twitter") || n.includes(" x ")) return "Twitter/X";
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return "Shopee";
  return "Other";
}
const contains = (a = "", b = "") => String(a).toLowerCase().includes(String(b).toLowerCase());
const ACTION_SYNONYMS = {
  Followers: ["follow", "subscriber", "sub"],
  Likes: ["like", "page like", "post like", "photo like", "reactions like"],
  Views: ["view", "watch", "plays"],
  Comments: ["comment"],
  Shares: ["share"],
  Subscribers: ["subscriber", "sub"],
  Members: ["member"],
  Reactions: ["reaction"],
};
function matchAction(cat = "", action = "") {
  if (!action) return true;
  const c = String(cat).toLowerCase();
  const a = String(action).toLowerCase();
  if (contains(c, a) || contains(a, c)) return true;
  const syn = ACTION_SYNONYMS[action] || [];
  return syn.some((k) => c.includes(k));
}

// Normalisasi item layanan ke schema sederhana untuk FE
function mapService(s, platform = "", action = "") {
  return {
    provider_service_id:
      s?.id ?? s?.service ?? s?.service_id ?? s?.provider_service_id ?? null,
    name: s?.name || `${platform} ${action}`.trim(),
    category: s?.category || "",
    min: Number(s?.min ?? s?.min_qty ?? 1),
    max: Number(s?.max ?? s?.max_qty ?? 100000),
    // Banyak panel pakai "price" atau "rate" per 1k (sering kali per 1000)
    rate_per_1k: Number(s?.price ?? s?.rate ?? s?.price_per_1000 ?? 0),
    description: s?.note || s?.description || "",
    raw: undefined, // bisa dibuang untuk mengurangi payload; simpan kalau perlu debug
  };
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Use GET" });

  const platform = String(req.query.platform || "").trim(); // contoh: Instagram
  const action = String(req.query.action || "").trim(); // contoh: Followers

  try {
    if (!PANEL_URL || !PANEL_KEY) {
      return res.status(200).json([]); // env belum diset → kosong, tapi 200 agar FE tidak crash
    }

    // pusatpanelsmm -> POST x-www-form-urlencoded
    const body = new URLSearchParams({ api_key: PANEL_KEY, action: "services" });
    if (PANEL_SECRET) body.set("secret_key", PANEL_SECRET);

    const r = await fetch(PANEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    const text = await r.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    // Beberapa panel membungkus data di {status, data:[...]}; amankan keduanya
    let list = [];
    if (Array.isArray(payload)) list = payload;
    else if (Array.isArray(payload?.data)) list = payload.data;

    // Filter platform → lalu filter action (longgar)
    let filtered = list;
    if (platform) filtered = filtered.filter((s) =>
      guessPlatform(s?.name || s?.category || "") === platform
    );
    if (action) filtered = filtered.filter((s) => matchAction(s?.category || "", action));

    // Fallback: kalau filter terlalu ketat dan kosong, kembalikan 20 layanan pertama dari platform tsb
    if (filtered.length === 0 && platform) {
      filtered = list.filter((s) =>
        guessPlatform(s?.name || s?.category || "") === platform
      ).slice(0, 20);
    }

    return res.status(200).json(filtered.map((s) => mapService(s, platform, action)));
  } catch (e) {
    // Jangan buat FE error—kembalikan array kosong agar UI tetap jalan
    return res.status(200).json([]);
  }
};
