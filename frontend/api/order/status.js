// api/order/status.js
export default async function handler(req, res) {
  try {
    const { order_id } = req.query;
    if (!order_id) {
      return res.status(400).json({ message: "order_id diperlukan" });
    }

    // ENV yang perlu kamu set di Vercel Project → Settings → Environment Variables
    const PANEL_API_URL = process.env.PANEL_API_URL; // contoh: https://panelmu.com/api/v2
    const PANEL_KEY = process.env.PANEL_KEY;         // API key dari panel

    if (!PANEL_API_URL || !PANEL_KEY) {
      return res.status(500).json({ message: "PANEL_API_URL / PANEL_KEY belum diset" });
    }

    // Kirim ke panel (SMM API v2)
    const body = new URLSearchParams({
      key: PANEL_KEY,
      action: "status",
      order: order_id,
    });

    const r = await fetch(PANEL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(500).json({ message: j?.error || "Gagal ambil status dari panel" });
    }

    // Normalisasi output agar frontend gampang konsumsi
    return res.status(200).json({
      order_id: j.order ?? j.order_id ?? j.id ?? String(order_id),
      provider_order_id: j.provider_order ?? j.provider_order_id ?? null,
      status: j.status ?? j.order_status ?? "unknown",
      start_count: j.start_count ?? null,
      remains: j.remains ?? j.remain ?? null,
      charge: j.charge ?? null,
      created_at: j.created ?? j.created_at ?? null,
      raw: j, // opsional: kirim mentah untuk debugging
    });
  } catch (e) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
