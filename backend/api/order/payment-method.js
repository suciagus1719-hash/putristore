// backend/api/order/payment-method.js
const applyCors = require("./cors");
const { getOrder, saveOrder } = require("./orderStore");

function safeJson(body) {
  if (typeof body === "object" && body !== null) return body;
  try {
    return JSON.parse(body || "{}");
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
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

  const order = await getOrder(order_id);
  if (!order) {
    return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  }

  order.payment = order.payment || {};
  order.payment.method = method;
  order.payment.amount = Number(amount) || order.payment.amount || 0;
  order.payment.updated_at = new Date().toISOString();
  order.status = "waiting_payment_proof";
  order.updated_at = new Date().toISOString();

  await saveOrder(order);

  return res.status(200).json({ ok: true, order });
};
