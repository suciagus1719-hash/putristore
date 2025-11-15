const fetch = global.fetch || require("node-fetch");
const ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";

function guessPlatform(name="") {
  const n = name.toLowerCase();
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("youtube")) return "YouTube";
  if (n.includes("facebook")) return "Facebook";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("twitter") || n.includes("x")) return "Twitter/X";
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return "Shopee";
  return "Other";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const FALLBACK = ["TikTok","Twitter/X","Instagram","YouTube","Facebook","Telegram","Shopee","Other"];

  try {
    const API = process.env.SMMPANEL_BASE_URL;
    const KEY = process.env.SMMPANEL_API_KEY;
    const SEC = process.env.SMMPANEL_SECRET;

    if (!API || !KEY || !SEC) return res.status(200).json(FALLBACK);

    const form = new URLSearchParams({ api_key: KEY, secret_key: SEC, action: "services" });
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }, body: form });
    const text = await r.text();
    let list; try { list = JSON.parse(text); } catch { list = []; }

    const set = new Set();
    for (const s of list) set.add(guessPlatform(String(s?.name || s?.category || "")));
    const out = Array.from(set);
    return res.status(200).json(out.length ? out : FALLBACK);
  } catch {
    return res.status(200).json(FALLBACK);
  }
}
