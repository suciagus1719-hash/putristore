const ORIGIN = "https://suciagus1719-hash.github.io";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const platform = String(req.query.platform || "").trim();
  const action   = String(req.query.action || "").trim();  // kategori

  try {
    const API = process.env.SMMPANEL_BASE_URL;
    const KEY = process.env.SMMPANEL_API_KEY;
    const SEC = process.env.SMMPANEL_SECRET;

    const body = new URLSearchParams({ api_key: KEY, secret_key: SEC, action: "services" });
    const r = await fetch(API, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded","Accept":"application/json" }, body });
    const text = await r.text();
    let list; try { list = JSON.parse(text); } catch { list = []; }

    const out = [];
    for (const s of (list||[])) {
      const plat = guessPlatform(String(s?.name || s?.category || ""));
      const cat  = String(s?.category || s?.type || "Other");
      if (platform && plat !== platform) continue;
      if (action && cat !== action) continue;

      out.push({
        provider_service_id: s?.service_id || s?.id || s?.service || s?.provider_service_id,
        name: s?.name || s?.service_name || "Service",
        min: Number(s?.min || s?.min_qty || 1),
        max: Number(s?.max || s?.max_qty || 100000),
        rate_per_1k: Number(s?.rate_per_1k || s?.price_per_1000 || s?.rate || 0),
        description: s?.description || "",
      });
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ ok:false, message: String(e?.message||e) });
  }
}
