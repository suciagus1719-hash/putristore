// api/order/status.js  (versi DIAGNOSTIK)
export default async function handler(req, res) {
  try {
    const order_id = String(req.query.order_id ?? req.body?.order_id ?? "").trim();
    if (!order_id) return res.status(400).json({ ok:false, message: "order_id diperlukan" });

    const API_URL =
      process.env.SMMPANEL_BASE_URL ||
      process.env.PANEL_API_URL ||
      "https://pusatpanelsmm.com/api/json.php";

    const API_KEY = process.env.SMMPANEL_API_KEY;
    const SECRET  = process.env.SMMPANEL_SECRET;

    if (!API_KEY || !SECRET) {
      return res.status(500).json({ ok:false, message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });
    }

    const debug = { apiUrl: API_URL, order_id, tries: [] };

    // --- TRY 1: application/x-www-form-urlencoded (banyak panel pakai ini) ---
    const form = new URLSearchParams({
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: order_id,            // <— wajib lower-case "id"
    });

    let r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept":"application/json" },
      body: form,
    });
    let text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }

    debug.tries.push({
      mode: "POST_FORM",
      sent: Object.fromEntries(form),      // apa yg dikirim
      status: r.status,
      ok: r.ok,
      panel_raw_text: text,
      panel_parsed: parsed,
    });

    const looksIdMissing = String(text).toLowerCase().includes("id required");

    // --- TRY 2: application/json (sebagian instance membaca JSON) ---
    if (!r.ok || looksIdMissing) {
      const jsonBody = {
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: Number(order_id),              // kirim numeric juga
      };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify(jsonBody),
      });
      text = await r.text();
      try { parsed = JSON.parse(text); } catch { parsed = null; }

      debug.tries.push({
        mode: "POST_JSON",
        sent: jsonBody,
        status: r.status,
        ok: r.ok,
        panel_raw_text: text,
        panel_parsed: parsed,
      });
    }

    // sukses jika panel balas { status: true, data: {...} }
    const last = debug.tries.at(-1);
    if (last?.panel_parsed?.status === true) {
      const d = last.panel_parsed.data || {};
      return res.status(200).json({
        ok: true,
        order_id,
        status: d.status ?? "unknown",
        start_count: d.start_count ?? null,
        remains: d.remains ?? null,
        charge: d.charge ?? null,
        debug
      });
    }

    // jika masih gagal, kembalikan detail debug penuh
    return res.status(502).json({
      ok: false,
      message: last?.panel_parsed?.data?.msg || last?.panel_parsed?.error || "Gagal mengambil status dari panel",
      debug
    });

  } catch (e) {
    return res.status(500).json({ ok:false, message: String(e?.message || e) });
  }
}
