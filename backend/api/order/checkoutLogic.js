const crypto = require("crypto");
const fetch = global.fetch || require("node-fetch");
const { kv } = require("@vercel/kv");

const PANEL_API_URL =
  process.env.SMMPANEL_BASE_URL ||
  process.env.PANEL_API_URL ||
  "https://pusatpanelsmm.com/api/json.php";
const PANEL_KEY = process.env.SMMPANEL_API_KEY;
const PANEL_SECRET = process.env.SMMPANEL_SECRET;

const IPAYMU_VA = process.env.IPAYMU_VA;
const IPAYMU_API = process.env.IPAYMU_API;
const IPAYMU_URL = process.env.IPAYMU_URL || "https://my.ipaymu.com/api/v2/payment";

const FRONTEND_RETURN =
  process.env.RETURN_URL ||
  (process.env.FRONTEND_ORIGIN
    ? `${process.env.FRONTEND_ORIGIN}/putristore/`
    : "https://suciagus1719-hash.github.io/putristore/");

const NOTIFY_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://putristore-backend.vercel.app";

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function saveOrderMeta(meta) {
  if (!meta || !meta.order_id) return;
  try {
    await kv.set(`order:${meta.order_id}`, JSON.stringify(meta), { ex: 60 * 60 * 24 * 90 });
  } catch (e) {
    console.error("kv.set error:", e);
  }
}

async function processCheckout(body = {}) {
  try {
    const service_id =
      body.service_id || body.serviceId || body.service || body.serviceID || null;
    const link =
      body.link || body.target || body.url || body.username || body.profile || null;
    const rawQuantity = body.quantity ?? body.qty ?? body.volume ?? body.count ?? null;
    const service_name = body.service_name || body.serviceName || null;
    const rawCharge = body.charge ?? body.price ?? body.amount ?? null;
    const name = body.name || body.customer?.name || null;
    const email = body.email || body.customer?.email || null;
    const phone = body.phone || body.customer?.phone || null;

    if (!service_id || !link || rawQuantity === undefined || rawQuantity === null) {
      return {
        statusCode: 400,
        body: { ok: false, message: "service_id, link, quantity diperlukan" },
      };
    }

    const quantity = toNum(rawQuantity);
    if (!quantity || quantity <= 0) {
      return { statusCode: 400, body: { ok: false, message: "quantity harus > 0" } };
    }

    if (!PANEL_KEY || !PANEL_SECRET) {
      return {
        statusCode: 500,
        body: { ok: false, message: "Server belum dikonfigurasi (SMMPANEL env missing)" },
      };
    }

    const panelPayload = new URLSearchParams({
      api_key: PANEL_KEY,
      secret_key: PANEL_SECRET,
      action: "add",
      service: String(service_id),
      link: String(link),
      quantity: String(quantity),
    });

    let r = await fetch(PANEL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: panelPayload,
    });
    let text = await r.text();
    let pj;
    try {
      pj = JSON.parse(text);
    } catch {
      pj = null;
    }

    if (!r.ok || !pj || pj.status !== true) {
      const fallback = {
        api_key: PANEL_KEY,
        secret_key: PANEL_SECRET,
        action: "add",
        service: Number(service_id),
        link,
        quantity: Number(quantity),
      };
      r = await fetch(PANEL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fallback),
      });
      text = await r.text();
      try {
        pj = JSON.parse(text);
      } catch {
        pj = null;
      }
    }

    if (!pj || pj.status !== true || !pj.data || !pj.data.id) {
      console.error("panel create order failed:", { status: r.status, pj, text });
      return {
        statusCode: 502,
        body: { ok: false, message: "Gagal membuat order di panel", raw: pj || text },
      };
    }

    const order_id = String(pj.data.id);
    const charge = toNum(rawCharge) ?? toNum(pj.data.charge) ?? null;

    await saveOrderMeta({
      order_id,
      target: link,
      service_name: service_name || null,
      quantity,
      charge,
      created_at: new Date().toISOString(),
    });

    if (!IPAYMU_VA || !IPAYMU_API) {
      return {
        statusCode: 200,
        body: { ok: true, order_id, message: "Order dibuat, namun payment gateway belum di-konfigurasi." },
      };
    }

    const amount = Number(charge) || 1000;
    const ipayBody = {
      product: [`Order #${order_id} - ${service_name || "Layanan"}`],
      qty: [1],
      price: [amount],
      returnUrl: FRONTEND_RETURN,
      notifyUrl: `${process.env.PAYMU_NOTIFY_URL || NOTIFY_BASE + "/api/paymu_webhook"}`,
      buyerName: name || "Pembeli",
      buyerEmail: email || "no-reply@example.com",
      buyerPhone: phone || "08123456789",
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
        va: IPAYMU_VA,
        signature: signatureHex,
        timestamp,
        Accept: "application/json",
      },
      body: json,
    });

    const payText = await payResp.text();
    let payJson;
    try {
      payJson = JSON.parse(payText);
    } catch {
      payJson = { raw: payText };
    }

    const checkoutUrl =
      payJson?.Data?.Url ||
      payJson?.Data?.url ||
      payJson?.Data?.checkoutUrl ||
      payJson?.checkoutUrl ||
      null;

    if (payResp.ok && checkoutUrl) {
      await saveOrderMeta({
        order_id,
        checkout_url: checkoutUrl,
        gateway: "ipaymu",
        charge: amount,
        updated_at: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: { ok: true, order_id, checkout_url: checkoutUrl, raw: payJson },
      };
    }

    console.error("ipaymu create payment failed:", { status: payResp.status, payJson, payText });
    return {
      statusCode: 502,
      body: {
        ok: false,
        message: "Gagal membuat payment gateway",
        status: payResp.status,
        result: payJson || payText,
      },
    };
  } catch (err) {
    console.error("processCheckout error:", err);
    return { statusCode: 500, body: { ok: false, message: String(err?.message || err) } };
  }
}

module.exports = { processCheckout };
