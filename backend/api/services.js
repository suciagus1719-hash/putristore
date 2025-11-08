// GET /api/services?platform=TikTok&action=Followers
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://suciagus1719-hash.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const { platform = "", action = "" } = req.query;

  // Contoh dummy minimal — sesuaikan nanti dengan data panel SMM kamu
  const list = [
    {
      provider_service_id: 1001,
      name: `${platform} ${action} (Normal)`,
      min: 100,
      max: 100000,
      rate_per_1k: 15000,
      description: "Contoh layanan dummy. Ganti dgn data nyata dari panel."
    },
    {
      provider_service_id: 1002,
      name: `${platform} ${action} (Premium)`,
      min: 100,
      max: 50000,
      rate_per_1k: 30000,
      description: "Contoh layanan dummy Premium."
    }
  ];

  res.status(200).json(list);
}
