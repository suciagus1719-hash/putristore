// api/status_probe.js  — endpoint diagnosa
export default async function handler(req, res) {
  try {
    const order_id = String(req.query.order_id ?? req.body?.order_id ?? "").trim();

    const API_URL =
      process.env.SMMPANEL_BASE_URL ||
      process.env.PANEL_API_URL ||
      "https://pusatpanelsmm.com/api/json.php";

    const API_KEY = process.env.SMMPANEL_API_KEY;
    const SECRET  = process.env.SMMPANEL_SECRET;

    const diag = {
      order_id,
      env: {
        has_API_KEY: Boolean(API_KEY),
        has_SECRET: Boolean(SECRET),
        api_url: API_URL,
      },
      tries: []
    };

    if (!order_id) {
      return res.status(400).json({ ok:false, message: "order_id diperlukan", diag });
    }
    if (!API_KEY || !SECRET) {
      return res.status(500).json({ ok:false, message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset", diag });
    }

    // TRY 1: POST form-urlencoded
    const form = new URLSearchParams({
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: order_id, // harus lower-case "id"
    });
    let r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });
    let text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }

    diag.tries.push({
      mode: "POST_FORM",
      sent: Object.fromEntries(form),
      status: r.status,
      ok: r.ok,
      panel_raw_text: text,
      panel_parsed: parsed,
    });

    // Jika masih ada “id required”/gagal → TRY 2: POST JSON
    const looksIdMissing = String(text).toLowerCase().includes("id required");
    if (!r.ok || looksIdMissing) {
      const jsonBody = {
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: Number(order_id),
      };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(jsonBody),
      });
      text = await r.text();
      try { parsed = JSON.parse(text); } catch { parsed = null; }

      diag.tries.push({
        mode: "POST_JSON",
        sent: jsonBody,
        status: r.status,
        ok: r.ok,
        panel_raw_text: text,
        panel_parsed: parsed,
      });
    }

    return res.status(200).json({ ok:true, diag });
  } catch (e) {
    return res.status(500).json({ ok:false, message: String(e?.message || e) });
  }
}
