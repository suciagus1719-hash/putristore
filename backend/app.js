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
const { saveOrder } = require("./routes/order/orderStore");

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
const REVIEW_DEADLINE_MS = Number(process.env.REVIEW_DEADLINE_MS || 24 * 60 * 60 * 1000);
const PAYMENT_WINDOW_MINUTES = Math.max(Number(process.env.PAYMENT_WINDOW_MINUTES || 30), 5);
const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;
const createOrderId = () => `ORD-${Date.now().toString(36).toUpperCase()}`;
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const normalizeCustomer = (customer = {}) => ({
  name: String(customer.name || "").trim(),
  phone: String(customer.phone || "").trim(),
  email: String(customer.email || "").trim(),
});

async function queueOrderForReview(payload = {}) {
  const now = new Date();
  const amount = toNumber(payload.charge);
  const quantity = Number(payload.quantity);
  const holdUntil = new Date(now.getTime() + PAYMENT_WINDOW_MS).toISOString();
  const reviewDeadline = new Date(now.getTime() + REVIEW_DEADLINE_MS).toISOString();

  const order = {
    order_id: createOrderId(),
    service_id: String(payload.service_id),
    service_name: payload.service_name ? String(payload.service_name).trim() : null,
    platform: payload.platform ? String(payload.platform).trim() : null,
    category: payload.category ? String(payload.category).trim() : null,
    quantity,
    target: String(payload.link || payload.target || "").trim(),
    customer: normalizeCustomer(payload.customer),
    notes: payload.notes ? String(payload.notes).trim() : null,
    status: "waiting_review",
    created_at: now.toISOString(),
    hold_until: holdUntil,
    review_deadline: reviewDeadline,
    price: {
      unit: amount && quantity > 0 ? amount / quantity : null,
      total: amount,
      currency: "IDR",
    },
    payment: {
      method: null,
      amount,
      proof_status: "pending_upload",
      proof_channel: "upload",
      reported_at: now.toISOString(),
      expires_at: holdUntil,
      notes: null,
    },
    timeline: {
      payment_reported_at: now.toISOString(),
    },
  };

  await saveOrder(order);
  return order;
}
// POST /api/order/create
// body: { service_id, link, quantity, service_name, charge }
app.post("/api/order/create", async (req, res) => {
  try {
    const { service_id, link, quantity } = req.body || {};
    const normalizedQty = Number(quantity);
    if (!service_id || !link || !Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      return res.status(400).json({ message: "service_id, link, quantity diperlukan" });
    }

    const queued = await queueOrderForReview(req.body || {});
    res.json({ order_id: queued.order_id, status: queued.status, ok: true, order: queued });
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

