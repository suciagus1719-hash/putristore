// backend/api/order/orderStore.js
const { kv } = require("@vercel/kv");

const STORE_KEY = "__putristore_orders";
const memStore = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = memStore;

const hasKV =
  Boolean(process.env.KV_REST_API_URL || process.env.KV_URL || process.env.REDIS_URL) &&
  typeof kv?.set === "function";

async function persist(order) {
  if (!hasKV || !order?.order_id) return;
  try {
    await kv.set(`order:${order.order_id}`, order, { ex: 60 * 60 * 24 * 30 }); // 30 hari
  } catch (err) {
    console.warn("kv.set gagal:", err.message);
  }
}

async function fetchFromKV(orderId) {
  if (!hasKV || !orderId) return null;
  try {
    const raw = await kv.get(`order:${orderId}`);
    if (!raw) return null;
    const order = typeof raw === "string" ? JSON.parse(raw) : raw;
    memStore.set(orderId, order);
    return order;
  } catch (err) {
    console.warn("kv.get gagal:", err.message);
    return null;
  }
}

async function saveOrder(order) {
  if (!order || !order.order_id) return null;
  memStore.set(order.order_id, order);
  await persist(order);
  return order;
}

async function getOrder(orderId) {
  if (!orderId) return null;
  if (memStore.has(orderId)) return memStore.get(orderId);
  return fetchFromKV(orderId);
}

module.exports = {
  saveOrder,
  getOrder,
};
