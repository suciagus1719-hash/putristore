// GET /api/actions?platform=Facebook
// Ambil semua layanan dari panel -> kumpulkan kategori untuk platform tsb.

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

const FALLBACK = ["Followers","Likes","Views","Comments","Shares","Subscribers","Members","Reactions","Other"];

export default async function handler(req, res) {
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
    if (!API || !KEY || !SEC) return res.status(200).json(FALLBACK);

    const body = new URLSearchParams({ api_key: KEY, secret_key: SEC, action: "services" });
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }, body });
    const text = await r.text();

    let payload; try { payload = JSON.parse(text); } catch { payload = {}; }
    const list = Array.isArray(payload?.data) ? payload.data : []; // sesuai dok. "status/data" :contentReference[oaicite:1]{index=1}

    const set = new Set();
    for (const s of list) {
      const plat = guessPlatform(s?.name || s?.category || "");
      if (plat !== platform) continue;
      const raw = String(s?.category || "Other").trim();
      // Normalisasi ringan → Likes/Followers/Views/Comments/Shares/...
      let label = raw;
      if (/subscriber|sub/i.test(raw)) label = "Subscribers";
      else if (/member/i.test(raw)) label = "Members";
      else if (/reaction/i.test(raw)) label = "Reactions";
      else if (/comment/i.test(raw)) label = "Comments";
      else if (/share/i.test(raw)) label = "Shares";
      else if (/like/i.test(raw)) label = "Likes";
      else if (/view|watch|play/i.test(raw)) label = "Views";
      else if (/follow/i.test(raw)) label = "Followers";
      set.add(label);
    }

    const out = Array.from(set);
    const order = ["Followers","Likes","Views","Comments","Shares","Subscribers","Members","Reactions","Other"];
    out.sort((a,b)=>(order.indexOf(a)+999)-(order.indexOf(b)+999));

    return res.status(200).json(out.length ? out : FALLBACK);
  } catch {
    return res.status(200).json(FALLBACK);
  }
}
