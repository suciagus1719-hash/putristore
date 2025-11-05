// api/order/status.js
export default async function handler(req, res) {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });

    const PANEL_API_URL = process.env.PANEL_API_URL; // contoh: https://panelmu.com/api/v2
    const PANEL_KEY     = process.env.PANEL_KEY;     // API key dari panel

    if (!PANEL_API_URL || !PANEL_KEY) {
      return res.status(500).json({ message: "PANEL_API_URL / PANEL_KEY belum diset" });
    }

    // Kirim SEMUA variasi field yang umum dipakai panel SMM
    const body = new URLSearchParams({
      // api key variants
      key: PANEL_KEY,
      api_key: PANEL_KEY,

      // action variants
      action: "status",
      // beberapa panel pakai 'order_status' sebagai action—tambahkan juga:
      order_status: "1",

      // id/order field variants
      id: order_id,
      order: order_id,
      order_id: order_id,
    });

    const r = await fetch(PANEL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    // panel kadang balas text/plain; coba parse JSON, kalau gagal bungkus sebagai text
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); } catch { j = { raw_text: text }; }

    if (!r.ok) {
      return res.status(500).json({ message: j?.error || "Gagal ambil status dari panel", raw: j });
    }

    // Normalisasi agar frontend mudah konsumsi
    return res.status(200).json({
      order_id: j.order ?? j.order_id ?? j.id ?? String(order_id),
      provider_order_id: j.provider_order ?? j.provider_order_id ?? null,
      status: j.status ?? j.order_status ?? "unknown",
      start_count: j.start_count ?? null,
      remains: j.remains ?? j.remain ?? null,
      charge: j.charge ?? null,
      created_at: j.created ?? j.created_at ?? null,
      raw: j,
    });
  } catch (e) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
