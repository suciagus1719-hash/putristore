export default function handler(req, res) {
  res.status(200).send('Backend OK');
}
// api/index.js
// Express app dibungkus serverless sehingga cocok untuk Vercel
const express = require("express");
const serverless = require("serverless-http");
const crypto = require("crypto");
const fetch = global.fetch || require("node-fetch");
const { kv } = require("@vercel/kv");
const paymentFlow = require("./order/paymentFlow");
app.use("/api", paymentFlow);

const app = express();
app.use(express.json({ limit: "200kb" }));

// CORS middleware (sesuaikan FRONTEND_ORIGIN di env untuk production)
app.use((req, res, next) => {
  const ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Helper untuk simpan/get order meta di KV
async function saveOrderMeta(meta) {
  if (!meta || !meta.order_id) return;
  try {
    await kv.set(`order:${meta.order_id}`, JSON.stringify(meta), { ex: 60 * 60 * 24 * 90 }); // 90 hari
  } catch (e) {
    console.error("kv.set error:", e);
  }
}
async function getOrderMeta(orderId) {
  try {
    const raw = await kv.get(`order:${orderId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error("kv.get error:", e);
    return null;
  }
}

// Env for panel & ipaymu
const PANEL_API_URL = process.env.SMMPANEL_BASE_URL || process.env.PANEL_API_URL || "https://pusatpanelsmm.com/api/json.php";
const PANEL_KEY = process.env.SMMPANEL_API_KEY;
const PANEL_SECRET = process.env.SMMPANEL_SECRET;

const IPAYMU_VA = process.env.IPAYMU_VA;
const IPAYMU_API = process.env.IPAYMU_API;
const IPAYMU_URL = process.env.IPAYMU_URL || "https://my.ipaymu.com/api/v2/payment";

// Simple normalization helper
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Route: /api/order/checkout
// Expect body: { service_id, link, quantity, service_name, charge, name, email, phone }
app.post("/api/order/checkout", async (req, res) => {
  try {
    // 1) validate input
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

    // 2) Ensure panel env set
    if (!PANEL_KEY || !PANEL_SECRET) {
      console.error("Missing panel env");
      return res.status(500).json({ ok: false, message: "Server belum dikonfigurasi (SMMPANEL env missing)" });
    }

    // 3) Create order at panel (form-urlencoded first)
    const panelPayload = new URLSearchParams({
      api_key: PANEL_KEY,
      secret_key: PANEL_SECRET,
      action: "add",            // sesuaikan aksi jika panel beda (beberapa panel pakai 'order' atau 'add')
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

    // If panel responded failure, try JSON body fallback
    if (!r.ok || !pj || pj.status !== true) {
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

    // Save metadata
    await saveOrderMeta({
      order_id,
      target: link,
      service_name: service_name || null,
      quantity,
      charge,
      created_at: new Date().toISOString()
    });

    // 4) Prepare payment via iPaymu if configured
    if (!IPAYMU_VA || !IPAYMU_API) {
      // kembalikan order_id tapi beri tahu payment gateway belum di-setup
      return res.status(200).json({
        ok: true,
        order_id,
        message: "Order dibuat, namun payment gateway belum di-konfigurasi."
      });
    }

    // Build iPaymu body (adapt sesuai dokumentasi iPaymu yang kamu gunakan)
    const amount = Number(charge) || 1000; // fallback minimal
    const ipayBody = {
      product: [`Order #${order_id} - ${service_name || "Layanan"}`],
      qty: [1],
      price: [amount],
      returnUrl: process.env.RETURN_URL || (process.env.FRONTEND_ORIGIN ? `${process.env.FRONTEND_ORIGIN}/putristore/` : "https://suciagus1719-hash.github.io/putristore/"),
      notifyUrl: process.env.PAYMU_NOTIFY_URL || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://putristore-backend.vercel.app"}/api/paymu_webhook`,
      buyerName: name || "Pembeli",
      buyerEmail: email || "no-reply@example.com",
      buyerPhone: phone || "08123456789"
    };

    const json = JSON.stringify(ipayBody);

    // signature steps: hash JSON -> sha256 hex, signSource -> HMAC-SHA256 with API key
    const hashHex = crypto.createHash("sha256").update(json).digest("hex");
    const signSource = `POST:${IPAYMU_VA}:${hashHex}:${IPAYMU_API}`;
    const signatureHex = crypto.createHmac("sha256", IPAYMU_API).update(signSource).digest("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Request ke iPaymu
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

    // Ambil checkout_url dari berbagai kemungkinan field
    const checkoutUrl = payJson?.Data?.Url || payJson?.Data?.url || payJson?.Data?.checkoutUrl || payJson?.checkoutUrl || null;

    if (payResp.ok && checkoutUrl) {
      // Simpan reference checkout di metadata (opsional)
      await saveOrderMeta({
        order_id,
        checkout_url: checkoutUrl,
        gateway: "ipaymu",
        charge: amount,
        updated_at: new Date().toISOString()
      });

      return res.status(200).json({
        ok: true,
        order_id,
        checkout_url: checkoutUrl,
        raw: payJson
      });
    } else {
      console.error("ipaymu create payment failed:", { status: payResp.status, payJson, payText });
      return res.status(502).json({ ok: false, message: "Gagal membuat payment gateway", status: payResp.status, result: payJson || payText });
    }
  } catch (err) {
    console.error("order/checkout error:", err);
    return res.status(500).json({ ok: false, message: String(err?.message || err) });
  }
});

// Expose the app as serverless handler
module.exports = app;
module.exports.handler = serverless(app);
