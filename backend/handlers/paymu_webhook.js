module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  console.log("Webhook Diterima:", req.body);
  // Tambahkan logika update status order di sini (opsional)
  return res.status(200).json({ ok: true });
};
