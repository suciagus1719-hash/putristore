// backend/api/order/orderStore.js
/**
 * Penyimpanan order sederhana menggunakan Map di memori.
 * Cocok untuk serverless Vercel karena tiap instance punya memori sendiri.
 * Untuk produksi sebaiknya ganti ke database permanen.
 */
const STORE_KEY = "__putristore_orders";

const orders = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = orders;

function saveOrder(order) {
  if (!order || !order.order_id) return null;
  orders.set(order.order_id, order);
  return order;
}

function getOrder(orderId) {
  if (!orderId) return null;
  return orders.get(orderId) || null;
}

module.exports = {
  saveOrder,
  getOrder,
  orders,
};
