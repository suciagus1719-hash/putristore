// GET /api/actions?platform=TikTok
const LIB = {
  Instagram: ["Followers","Likes","Views","Comments","Story Views"],
  TikTok: ["Followers","Views","Likes","Comments","Shares"],
  "Twitter/X": ["Followers","Likes","Views","Retweets"],
  YouTube: ["Subscribers","Views","Likes","Comments"],
  Facebook: ["Followers","Likes","Comments","Shares"],
  Telegram: ["Members","Views","Reactions"],
  Shopee: ["Product Views","Shop Followers"],
  Other: ["Custom"],
};

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://suciagus1719-hash.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const p = String(req.query.platform || "").trim();
  const actions = LIB[p] || [];
  res.status(200).json(actions);
}
