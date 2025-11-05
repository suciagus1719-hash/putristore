// api/order/status.js
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

    if (!API_KEY || !SECRET) {
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });
    }

    // helper normalisasi
    const normalize = (j) => {
      const d = j?.data || {};
      return {
        order_id,
        status: d.status ?? "unknown",
        start_count: d.start_count ?? null,
        remains: d.remains ?? null,
        charge: d.charge ?? null,
        raw: j,
      };
    };

    // --- 1) COBA: POST form-urlencoded (kebanyakan panel pakai ini) ---
    let resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: order_id, // <- WAJIB: nama persis "id"
      }),
    });
    let text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw_text: text }; }

    const textLower = String(text).toLowerCase();
    const looksIdMissing = textLower.includes("id required") || textLower.includes('"id" required');

    // --- 2) FALLBACK: POST JSON (kalau instance panel kamu membaca JSON) ---
    if (!resp.ok || looksIdMissing) {
      resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          api_key: API_KEY,
          secret_key: SECRET,
          action: "status",
          id: Number(order_id),
        }),
      });
      text = await resp.text();
      try { data = JSON.parse(text); } catch { data = { raw_text: text }; }
    }

    if (!resp.ok || data?.status !== true) {
      return res.status(502).json({
        message: data?.data?.msg || data?.error || "Gagal mengambil status dari panel",
        raw: data,
      });
    }

    return res.status(200).json(normalize(data));
  } catch (e) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
