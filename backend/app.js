// backend/index.js  (Express server di Vercel)
// CommonJS style (tidak perlu "type": "module")
const express = require("express");
const applyCors = require("./routes/order/cors");
const paymentFlow = require("./routes/order/paymentFlow");
const actionsHandler = require("./handlers/actions");
const servicesHandler = require("./handlers/services");
const platformsHandler = require("./handlers/platforms");
const statusProbeHandler = require("./handlers/status_probe");
const paymuCheckoutHandler = require("./handlers/paymu_checkout");
const paymuWebhookHandler = require("./handlers/paymu_webhook");

// Node 18+ punya fetch global, kalau Node kamu <18 hilangkan komentar 2 baris di bawah:
// const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
// CORS untuk mengizinkan request dari domain mana pun (Github Pages, dll.)
app.use((req, res, next) => {
  if (applyCors(req, res)) return;
  next();
});
const { kv } = require("@vercel/kv");

// simpan metadata order
async function saveOrderMeta(meta) {
  if (!meta?.order_id) return;
  // simpan sebagai JSON; TTL opsional (mis. 90 hari)
  await kv.set(`order:${meta.order_id}`, JSON.stringify(meta), { ex: 60 * 60 * 24 * 90 });
}

// ambil metadata order
async function getOrderMeta(orderId) {
  const raw = await kv.get(`order:${orderId}`);
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return raw || null; }
}
// POST /api/order/create
// body: { service_id, link, quantity, service_name, charge }
app.post("/api/order/create", async (req, res) => {
  try {
    const { service_id, link, quantity, service_name, charge } = req.body || {};
    if (!service_id || !link || !quantity) {
      return res.status(400).json({ message: "service_id, link, quantity diperlukan" });
    }

    // kirim ke panel (contoh generik; sesuaikan action sesuai dokumentasi panel)
    const payload = {
      api_key: API_KEY,
      secret_key: SECRET,
      action: "add",       // atau "order" sesuai panel
      service: Number(service_id),
      link,
      quantity: Number(quantity),
    };

    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();

    if (!r.ok || j?.status !== true || !j?.data?.id) {
      return res.status(502).json({ message: j?.data?.msg || j?.error || "Gagal membuat order", raw: j });
    }

    const order_id = String(j.data.id);

    // SIMPAN METADATA untuk dipakai saat cek status
    await saveOrderMeta({
      order_id,
      target: link,
      service_name: service_name || null,
      quantity: Number(quantity),
      charge: charge != null ? Number(charge) : null,
      created_at: new Date().toISOString(),
    });

    res.json({ order_id, ok: true });
  } catch (e) {
    res.status(500).json({ message: String(e?.message || e) });
  }
});

// ====== ENV dari Vercel ======
const API_URL =
  process.env.SMMPANEL_BASE_URL ||
  process.env.PANEL_API_URL ||
  "https://pusatpanelsmm.com/api/json.php";

const API_KEY = process.env.SMMPANEL_API_KEY;
const SECRET  = process.env.SMMPANEL_SECRET;
const IPAYMU_VA = process.env.IPAYMU_VA;
const IPAYMU_API = process.env.IPAYMU_API;

// Root
app.get("/", (req, res) => {
  res.send("putristore-backend OK");
});

app.all("/api/platforms", platformsHandler);
app.all("/api/actions", actionsHandler);
app.all("/api/services", servicesHandler);
app.all("/api/status_probe", statusProbeHandler);
app.all("/api/paymu_checkout", paymuCheckoutHandler);
app.all("/api/paymu_webhook", paymuWebhookHandler);
app.use("/api", paymentFlow);

module.exports = app;

