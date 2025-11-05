// api/order/status.js
export default async function handler(req, res) {
  try {
    // Ambil order_id dari query (?order_id=...) atau body JSON { order_id: ... }
    const order_id = String(
      req.query.order_id ?? (req.body && req.body.order_id) ?? ""
    ).trim();

    if (!order_id) {
      return res.status(400).json({ message: "order_id diperlukan" });
    }

    // ENV (set di Vercel → Project → Settings → Environment Variables)
    const API_URL =
      process.env.PANEL_API_URL || "https://pusatpanelsmm.com/api/json.php";
    const API_KEY = process.env.SMMPANEL_API_KEY;
    const SECRET  = process.env.SMMPANEL_SECRET;

    if (!API_KEY || !SECRET) {
      return res
        .status(500)
        .json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });
    }

    // Panel ini mengharuskan body JSON (bukan form-urlencoded)
    const payload = {
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: Number(order_id), // panel minta numeric
    };

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));

    // Struktur sukses dari pusatpanelsmm biasanya { status: true, data: { ... } }
    if (!resp.ok || json?.status !== true) {
      return res.status(502).json({
        message: json?.data?.msg || json?.error || "Gagal mengambil status",
        raw: json,
      });
    }

    const d = json.data || {};

    // Normalisasi agar frontend gampang konsumsi
    return res.status(200).json({
      order_id: order_id,
      status: d.status ?? "unknown",
      start_count: d.start_count ?? null,
      remains: d.remains ?? null,
      charge: d.charge ?? null,
      raw: json, // tetap kirim buat debugging (aman di server)
    });
  } catch (e) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
