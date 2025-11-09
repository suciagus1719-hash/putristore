// backend/api/paymu_checkout.js
// CommonJS handler compatible with Vercel serverless (module.exports)
const fetch = global.fetch || require("node-fetch"); // Node 18+ punya fetch global, fallback bila perlu
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  // CORS headers (sesuaikan origin di production)
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const { name, email, phone, amount } = req.body || {};
    const va = process.env.IPAYMU_VA;
    const apiKey = process.env.IPAYMU_API;
    const url = "https://my.ipaymu.com/api/v2/payment";

    // Validasi ENV
    if (!va || !apiKey) {
      console.error("Missing IPAYMU_VA or IPAYMU_API in environment");
      return res.status(500).json({ ok: false, message: "Payment gateway not configured (missing env vars)" });
    }

    // Validasi request
    const numericAmount = Number(amount || 0);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ ok: false, message: "Amount harus berupa angka > 0" });
    }

    // Body sesuai dokumentasi iPaymu (sesuaikan bila perlu)
    const body = {
      product: ["Layanan SMM"],
      qty: [1],
      price: [numericAmount],
      returnUrl: process.env.RETURN_URL || "https://suciagus1719-hash.github.io/putristore/",
      notifyUrl: process.env.PAYMU_NOTIFY_URL || "https://putristore-backend.vercel.app/api/paymu_webhook",
      buyerName: name || "Test Buyer",
      buyerEmail: email || "test@example.com",
      buyerPhone: phone || "08123456789"
    };

    const json = JSON.stringify(body);

    // 1) hash body JSON dengan SHA-256 -> hex
    const hashHex = crypto.createHash("sha256").update(json).digest("hex");

    // 2) prepare sign source sesuai contoh: "POST:{va}:{hashHex}:{apiKey}"
    const signSource = `POST:${va}:${hashHex}:${apiKey}`;

    // 3) signature = HMAC-SHA256(signSource, apiKey) -> hex
    const signatureHex = crypto.createHmac("sha256", apiKey).update(signSource).digest("hex");

    // timestamp - gunakan unix seconds (string)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Request ke iPaymu
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "va": va,
        "signature": signatureHex,
        "timestamp": timestamp,
        "Accept": "application/json"
      },
      body: json,
      // timeout tidak otomatis di node-fetch v2, tapi Vercel function timeouts atasan platform
    });

    const text = await r.text();
    let result;
    try { result = JSON.parse(text); } catch (e) { result = { raw: text }; }

    // Logging untuk debugging (akan muncul di Vercel logs)
    console.info("ipaymu request", { url, status: r.status, ok: r.ok, signSourceLength: signSource.length });

    // iPaymu biasanya merespon struktur tertentu. Cek Data.Url atau Data.checkoutUrl tergantung versi
    const checkoutUrl = result?.Data?.Url || result?.Data?.url || result?.Data?.checkoutUrl || result?.checkoutUrl || null;

    if (r.ok && checkoutUrl) {
      return res.status(200).json({ ok: true, checkout_url: checkoutUrl, raw: result });
    } else {
      // kembalikan seluruh payload result supaya bisa di-debug dari frontend/devtools
      return res.status(400).json({ ok: false, message: "Gagal membuat payment", status: r.status, result });
    }
  } catch (err) {
    console.error("paymu_checkout error:", err);
    return res.status(500).json({ ok: false, message: String(err?.message || err) });
  }
};
