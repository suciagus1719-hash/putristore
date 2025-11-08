export default function handler(req, res) {
  // CORS utk GitHub Pages
  res.setHeader("Access-Control-Allow-Origin", "https://suciagus1719-hash.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  // Frontend kamu butuh array of strings
  res.status(200).json([
    "TikTok","Twitter/X","Instagram","YouTube","Facebook","Telegram","Shopee","Other"
  ]);
}
