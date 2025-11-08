// GET /api/actions?platform=Facebook
// Kembalikan daftar kategori untuk platform terpilih (dedupe + normalisasi)

const ORIGIN = "https://suciagus1719-hash.github.io";

// deteksi platform dari nama layanan/kategori panel
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

// sederhanakan label kategori: hapus kata platform & tipe konten umum
const simplify = (s = "") =>
  String(s)
    .replace(/facebook|instagram|tiktok|youtube|twitter|telegram|shopee|tokopedia|bukalapak/gi, "")
    .replace(/page|post|video|reels|story|channel|live|views?/gi, (m) =>
      // biarkan "Views" sebagai kata kunci utama
      /views?/i.test(m) ? "Views" : ""
    )
    .replace(/\s+/g, " ")
    .trim();

const FALLBACK = ["Followers", "Likes", "Views", "Comments", "Shares", "Subscribers", "Members", "Reactions", "Other"];

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const platform = String(req.query.platform || "").trim();
  if (!platform) return res.status(200).json(FALLBACK);

  try {
    const API = process.env.SMMPANEL_BASE_URL;
    const KEY = process.env.SMMPANEL_API_KEY;
    const SEC = process.env.SMMPANEL_SECRET;

    if (!API || !KEY || !SEC) {
      return res.status(200).json(FALLBACK);
    }

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

    const set = new Set();
    for (const s of list) {
      const plat = guessPlatform(s?.name || s?.category || "");
      if (plat !== platform) continue;

      const raw = String(s?.category || s?.type || "Other");
      const label = simplify(raw) || raw.trim();

      // Normalisasi akhir ke kosakata umum
      const l = label.toLowerCase();
      let finalLabel = label;

      if (/(subscriber|sub)/i.test(label)) finalLabel = "Subscribers";
      else if (/(member)/i.test(label)) finalLabel = "Members";
      else if (/(reaction)/i.test(label)) finalLabel = "Reactions";
      else if (/(comment)/i.test(label)) finalLabel = "Comments";
      else if (/(share)/i.test(label)) finalLabel = "Shares";
      else if (/(like)/i.test(label)) finalLabel = "Likes";
      else if (/(view)/i.test(label)) finalLabel = "Views";
      else if (/(follow)/i.test(label)) finalLabel = "Followers";
      else if (!finalLabel) finalLabel = "Other";

      set.add(finalLabel);
    }

    const out = Array.from(set);
    // urutkan agar “Followers, Likes, Views …” tampil duluan
    const order = ["Followers", "Likes", "Views", "Comments", "Shares", "Subscribers", "Members", "Reactions", "Other"];
    out.sort((a, b) => (order.indexOf(a) + 999) - (order.indexOf(b) + 999));

    return res.status(200).json(out.length ? out : FALLBACK);
  } catch {
    return res.status(200).json(FALLBACK);
  }
}
