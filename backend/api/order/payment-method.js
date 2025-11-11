// backend/api/order/payment-method.js
const { getOrder, saveOrder } = require("./orderStore");

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function safeJson(body) {
  if (typeof body === "object" && body !== null) return body;
  try {
    return JSON.parse(body || "{}");
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Use POST" });
  }

  const body = safeJson(req.body);
  const { order_id, method, amount } = body || {};
  if (!order_id) {
    return res.status(422).json({ ok: false, message: "order_id wajib disertakan" });
  }
  if (!method) {
    return res.status(422).json({ ok: false, message: "Metode pembayaran wajib dipilih" });
  }

  const order = getOrder(order_id);
  if (!order) {
    return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  }

  order.payment = order.payment || {};
  order.payment.method = method;
  order.payment.amount = Number(amount) || order.payment.amount || 0;
  order.payment.updated_at = new Date().toISOString();
  order.status = "waiting_payment_proof";
  order.updated_at = new Date().toISOString();

  saveOrder(order);

  return res.status(200).json({ ok: true, order });
};
