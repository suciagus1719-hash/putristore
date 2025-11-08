// GET /api/services?platform=Facebook&action=Likes
// Kembalikan daftar layanan yang cocok (fuzzy) + mapping field untuk UI.

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

const contains = (a = "", b = "") => String(a).toLowerCase().includes(String(b).toLowerCase());

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const platform = String(req.query.platform || "").trim();
  const action   = String(req.query.action   || "").trim(); // kategori (mis. Likes)

  try {
    const API = process.env.SMMPANEL_BASE_URL;
    const KEY = process.env.SMMPANEL_API_KEY;
    const SEC = process.env.SMMPANEL_SECRET;

    if (!API || !KEY || !SEC) {
      // ENV belum siap → biar UI menampilkan "Tidak ada layanan"
      return res.status(200).json([]);
    }

    // Ambil seluruh services dari panel
    const form = new URLSearchParams({ api_key: KEY, secret_key: SEC, action: "services" });
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });

    const text = await r.text();
    let list;
    try {
      list = JSON.parse(text);
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }

    // Filter sesuai platform & kategori (fuzzy)
    const out = [];
    for (const s of list) {
      const plat = guessPlatform(s?.name || s?.category || "");
      const cat  = String(s?.category || s?.type || "Other");

      if (platform && plat !== platform) continue;
      if (action && !(contains(cat, action) || contains(action, cat))) continue;

      out.push({
        provider_service_id: s?.service_id || s?.id || s?.service || s?.provider_service_id,
        name: s?.name || s?.service_name || `${platform} ${action}`,
        min: Number(s?.min || s?.min_qty || 1),
        max: Number(s?.max || s?.max_qty || 100000),
        // banyak panel kirim 'rate' / 'price_per_1000' / 'rate_per_1k'
        rate_per_1k: Number(s?.rate_per_1k || s?.price_per_1000 || s?.rate || 0),
        description: s?.description || "",
      });
    }

    return res.status(200).json(out); // kosong = UI akan tulis "Tidak ada layanan…"
  } catch {
    return res.status(200).json([]); // jangan 500; biar UI tetap hidup
  }
}
