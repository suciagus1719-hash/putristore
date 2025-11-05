// api/order/status.js
export default async function handler(req, res) {
  try {
    // ?order_id=123 atau body { order_id: "123" }
    const order_id = String(req.query.order_id ?? req.body?.order_id ?? "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });

    // Ambil ENV (pakai nama yang kamu pakai di Vercel)
    const API_URL =
      process.env.SMMPANEL_BASE_URL ||     // ← punyamu
      process.env.PANEL_API_URL ||         // ← alternatif
      "https://pusatpanelsmm.com/api/json.php";  // fallback aman

    const API_KEY = process.env.SMMPANEL_API_KEY;
    const SECRET  = process.env.SMMPANEL_SECRET;

    if (!API_KEY || !SECRET) {
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });
    }

    // Panel ini minta JSON body, bukan form-urlencoded
    const payload = {
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: Number(order_id),
    };

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));

    // Format sukses pusatpanelsmm: { status: true, data: {...} }
    if (!resp.ok || json?.status !== true) {
      return res.status(502).json({
        message: json?.data?.msg || json?.error || "Gagal mengambil status",
        raw: json,
      });
    }

    const d = json.data || {};
    return res.status(200).json({
      order_id,
      status: d.status ?? "unknown",
      start_count: d.start_count ?? null,
      remains: d.remains ?? null,
      charge: d.charge ?? null,
      raw: json, // untuk debugging
    });
  } catch (e) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
