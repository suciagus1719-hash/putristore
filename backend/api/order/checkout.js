// api/order/checkout.js
const crypto = require("crypto");
const fetch = global.fetch || require("node-fetch");
const { kv } = require("@vercel/kv");

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = async (req, res) => {
  // CORS - izinkan origin frontend kamu
  const FRONTEND = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";
  res.setHeader("Access-Control-Allow-Origin", FRONTEND);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });

  try {
    const {
      service_id, link, quantity: rawQuantity, service_name, charge: rawCharge,
      name, email, phone
    } = req.body || {};

    if (!service_id || !link || !rawQuantity) {
      return res.status(400).json({ ok: false, message: "service_id, link, quantity diperlukan" });
    }
    const quantity = toNum(rawQuantity);
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ ok: false, message: "quantity harus > 0" });
    }

    // env panel
    const PANEL_API_URL = process.env.SMMPANEL_BASE_URL || process.env.PANEL_API_URL || "https://pusatpanelsmm.com/api/json.php";
    const PANEL_KEY = process.env.SMMPANEL_API_KEY;
    const PANEL_SECRET = process.env.SMMPANEL_SECRET;

    if (!PANEL_KEY || !PANEL_SECRET) {
      console.error("Missing SMMPANEL env");
      return res.status(500).json({ ok: false, message: "Server belum dikonfigurasi (SMMPANEL env missing)" });
    }

    // 1) create order at panel
    const panelPayload = new URLSearchParams({
      api_key: PANEL_KEY,
      secret_key: PANEL_SECRET,
      action: "add",
      service: String(service_id),
      link: String(link),
      quantity: String(quantity)
    });

    let r = await fetch(PANEL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: panelPayload
    });
    let text = await r.text();
    let pj;
    try { pj = JSON.parse(text); } catch { pj = null; }

    if (!r.ok || !pj || pj.status !== true) {
      // fallback JSON body
      const fallback = {
        api_key: PANEL_KEY,
        secret_key: PANEL_SECRET,
        action: "add",
        service: Number(service_id),
        link,
        quantity: Number(quantity)
      };
      r = await fetch(PANEL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(fallback)
      });
      text = await r.text();
      try { pj = JSON.parse(text); } catch { pj = null; }
    }

    if (!pj || pj.status !== true || !pj.data || !pj.data.id) {
      console.error("panel create order failed:", { status: r.status, pj, text });
      return res.status(502).json({ ok: false, message: "Gagal membuat order di panel", raw: pj || text });
    }

    const order_id = String(pj.data.id);
    const charge = toNum(rawCharge) ?? (pj.data.charge ?? null);

    // save meta in KV (best-effort)
    try {
      if (kv) {
        await kv.set(`order:${order_id}`, JSON.stringify({
          order_id, target: link, service_name: service_name || null,
          quantity, charge, created_at: new Date().toISOString()
        }), { ex: 60*60*24*90 });
      }
    } catch (e) {
      console.error("kv.save error:", e);
    }

    // 2) iPaymu payment (optional)
    const IPAYMU_VA = process.env.IPAYMU_VA;
    const IPAYMU_API = process.env.IPAYMU_API;
    const IPAYMU_URL = process.env.IPAYMU_URL || "https://my.ipaymu.com/api/v2/payment";

    if (!IPAYMU_VA || !IPAYMU_API) {
      // return order_id but no payment
      return res.status(200).json({ ok: true, order_id, message: "Order dibuat, payment gateway belum dikonfigurasi." });
    }

    const amount = Number(charge) || 1000;
    const ipayBody = {
      product: [`Order #${order_id} - ${service_name || "Layanan"}`],
      qty: [1],
      price: [amount],
      returnUrl: process.env.RETURN_URL || `${FRONTEND}/putristore/`,
      notifyUrl: process.env.PAYMU_NOTIFY_URL || `https://${process.env.VERCEL_URL || "putristore-backend.vercel.app"}/api/paymu_webhook`,
      buyerName: name || "Pembeli",
      buyerEmail: email || "no-reply@example.com",
      buyerPhone: phone || "08123456789"
    };

    const json = JSON.stringify(ipayBody);
    const hashHex = crypto.createHash("sha256").update(json).digest("hex");
    const signSource = `POST:${IPAYMU_VA}:${hashHex}:${IPAYMU_API}`;
    const signatureHex = crypto.createHmac("sha256", IPAYMU_API).update(signSource).digest("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const payResp = await fetch(IPAYMU_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "va": IPAYMU_VA,
        "signature": signatureHex,
        "timestamp": timestamp,
        "Accept": "application/json"
      },
      body: json
    });

    const payText = await payResp.text();
    let payJson;
    try { payJson = JSON.parse(payText); } catch { payJson = { raw: payText }; }

    const checkoutUrl = payJson?.Data?.Url || payJson?.Data?.url || payJson?.Data?.checkoutUrl || payJson?.checkoutUrl || null;

    if (payResp.ok && checkoutUrl) {
      // try save checkout_url
      try { if (kv) await kv.set(`order:${order_id}`, JSON.stringify({ order_id, checkout_url: checkoutUrl }), { ex: 60*60*24*90 }); } catch (e) {}
      return res.status(200).json({ ok: true, order_id, checkout_url: checkoutUrl, raw: payJson });
    } else {
      console.error("ipaymu create payment failed:", { status: payResp.status, payJson, payText });
      return res.status(502).json({ ok: false, message: "Gagal membuat payment gateway", status: payResp.status, result: payJson || payText });
    }
  } catch (err) {
    console.error("order/checkout error:", err);
    return res.status(500).json({ ok: false, message: String(err?.message || err) });
  }
};
