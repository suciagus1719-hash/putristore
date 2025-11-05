// api/order/status.js (versi final untuk produksi)
export default async function handler(req, res) {
  try {
    const order_id = String(req.query.order_id ?? req.body?.order_id ?? "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });

    const API_URL =
      process.env.SMMPANEL_BASE_URL ||
      process.env.PANEL_API_URL ||
      "https://pusatpanelsmm.com/api/json.php";
    const API_KEY = process.env.SMMPANEL_API_KEY;
    const SECRET  = process.env.SMMPANEL_SECRET;

    if (!API_KEY || !SECRET)
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });

    // --- kirim form-urlencoded ---
    const form = new URLSearchParams({
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: order_id,
    });

    let r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });

    let text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = null; }

    const looksIdMissing = String(text).toLowerCase().includes("id required");

    // fallback ke JSON jika perlu
    if (!r.ok || !j || j.status !== true || looksIdMissing) {
      const payload = {
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: Number(order_id),
      };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      text = await r.text();
      try { j = JSON.parse(text); } catch { j = null; }
    }

    if (!j || j.status !== true) {
      return res.status(502).json({
        message: j?.data?.msg || j?.error || "Gagal mengambil status",
      });
    }

    const d = j.data || {};
    return res.status(200).json({
      order_id,
      status: d.status ?? "unknown",
      start_count: d.start_count ?? null,
      remains: d.remains ?? null,
      charge: d.charge ?? null,
    });
  } catch (e) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
