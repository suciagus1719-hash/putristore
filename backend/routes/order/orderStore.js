// backend/api/order/orderStore.js
const { kv } = require("@vercel/kv");

const STORE_KEY = "__putristore_orders";
const ORDER_INDEX_KEY = "__putristore_order_index";
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari
const DEFAULT_HISTORY_LIMIT = 500;
const envHistoryLimit =
  Number(process.env.ADMIN_HISTORY_LIMIT ?? process.env.ADMIN_MAX_ORDERS ?? DEFAULT_HISTORY_LIMIT);
const ORDER_HISTORY_LIMIT =
  Number.isFinite(envHistoryLimit) && envHistoryLimit > 0 ? envHistoryLimit : DEFAULT_HISTORY_LIMIT;

const memStore = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = memStore;

const hasKV =
  Boolean(process.env.KV_REST_API_URL || process.env.KV_URL || process.env.REDIS_URL) &&
  typeof kv?.set === "function";

const decodeOrder = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
};

const resolveOrderScore = (order) => {
  if (!order) return Date.now();
  const candidate =
    order.created_at ||
    order.timeline?.pending_payment_at ||
    order.timeline?.proof_uploaded_at ||
    order.timeline?.admin_reviewed_at ||
    order.payment?.requested_at;
  const score = candidate ? Date.parse(candidate) : NaN;
  return Number.isFinite(score) ? score : Date.now();
};

async function persist(order) {
  if (!hasKV || !order?.order_id) return;
  try {
    const key = `order:${order.order_id}`;
    await kv.set(key, order, { ex: ORDER_TTL_SECONDS });
    await kv.zadd(ORDER_INDEX_KEY, {
      score: resolveOrderScore(order),
      member: order.order_id,
    });
    await kv.expire(ORDER_INDEX_KEY, ORDER_TTL_SECONDS);

    if (ORDER_HISTORY_LIMIT > 0) {
      const total = await kv.zcard(ORDER_INDEX_KEY);
      const overflow = total - ORDER_HISTORY_LIMIT;
      if (overflow > 0) {
        const obsoleteIds = await kv.zrange(ORDER_INDEX_KEY, 0, overflow - 1);
        if (obsoleteIds?.length) {
          await kv.zrem(ORDER_INDEX_KEY, ...obsoleteIds);
          await kv.del(...obsoleteIds.map((id) => `order:${id}`));
          obsoleteIds.forEach((id) => memStore.delete(id));
        }
      }
    }
  } catch (err) {
    console.warn("kv.persist gagal:", err.message);
  }
}

async function fetchFromKV(orderId) {
  if (!hasKV || !orderId) return null;
  try {
    const raw = await kv.get(`order:${orderId}`);
    if (!raw) return null;
    const order = decodeOrder(raw);
    if (order?.order_id) {
      memStore.set(orderId, order);
    }
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

async function listOrders() {
  const localOrders = Array.from(memStore.values());
  if (!hasKV) return localOrders;

  try {
    const ids = await kv.zrange(ORDER_INDEX_KEY, 0, -1, { rev: true });
    if (!ids?.length) return localOrders;

    const keys = ids.map((id) => `order:${id}`);
    const rawEntries = keys.length ? await kv.mget(...keys) : [];
    const remoteOrders = rawEntries
      .map((entry) => decodeOrder(entry))
      .filter((order) => order?.order_id);

    if (!remoteOrders.length) return localOrders;

    const merged = new Map();
    remoteOrders.forEach((order) => merged.set(order.order_id, order));
    localOrders.forEach((order) => {
      if (order?.order_id && !merged.has(order.order_id)) {
        merged.set(order.order_id, order);
      }
    });

    return Array.from(merged.values()).sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a));
  } catch (err) {
    console.warn("kv.listOrders gagal:", err.message);
    return localOrders;
  }
}

module.exports = {
  saveOrder,
  getOrder,
  listOrders,
};
