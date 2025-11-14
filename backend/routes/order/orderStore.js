// backend/routes/order/orderStore.js
const fs = require("fs");
const os = require("os");
const path = require("path");

let kvClient = null;
let kvInitialized = false;

const loadKvClient = () => {
  if (kvInitialized) return kvClient;
  kvInitialized = true;

  const hasCreds = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasCreds) {
    kvClient = null;
    return kvClient;
  }

  try {
    // eslint-disable-next-line global-require
    ({ kv: kvClient } = require("@vercel/kv"));
  } catch (err) {
    console.warn("[orderStore] gagal memuat @vercel/kv:", err.message);
    kvClient = null;
  }
  return kvClient;
};

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

const diskDirCandidates = [
  process.env.ORDER_STORE_DIR,
  process.env.DATA_DIR,
  path.join(process.cwd(), ".data"),
  path.join(process.cwd(), "tmp"),
  path.join(os.tmpdir(), "putristore"),
].filter(Boolean);

let DISK_FILE = null;
for (const candidate of diskDirCandidates) {
  try {
    fs.mkdirSync(candidate, { recursive: true });
    DISK_FILE = path.join(candidate, "orders.json");
    break;
  } catch {
    DISK_FILE = null;
  }
}

const hasDiskStore = Boolean(DISK_FILE);
let diskLoaded = false;
const diskStore = new Map();

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
    order.review_deadline ||
    order.created_at ||
    order.timeline?.admin_reviewed_at ||
    order.timeline?.proof_uploaded_at ||
    order.timeline?.pending_payment_at ||
    order.payment?.uploaded_at ||
    order.payment?.reported_at;
  const score = candidate ? Date.parse(candidate) : NaN;
  return Number.isFinite(score) ? score : Date.now();
};

const ensureDiskLoaded = () => {
  if (!hasDiskStore || diskLoaded) return;
  diskLoaded = true;
  try {
    if (fs.existsSync(DISK_FILE)) {
      const raw = fs.readFileSync(DISK_FILE, "utf8");
      const parsed = JSON.parse(raw || "{}");
      const list = Array.isArray(parsed) ? parsed : parsed.orders || [];
      list
        .map((entry) => decodeOrder(entry))
        .filter((order) => order?.order_id)
        .forEach((order) => {
          diskStore.set(order.order_id, order);
          memStore.set(order.order_id, order);
        });
    }
  } catch (err) {
    console.warn("[orderStore] gagal memuat disk store:", err.message);
  }
};

const trimHistory = (orders) => {
  if (!Array.isArray(orders)) return [];
  if (orders.length <= ORDER_HISTORY_LIMIT) return orders;
  return orders
    .sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a))
    .slice(0, ORDER_HISTORY_LIMIT);
};

const persistDisk = (order) => {
  if (!hasDiskStore || !order?.order_id) return;
  ensureDiskLoaded();
  diskStore.set(order.order_id, order);

  try {
    const serialized = trimHistory(Array.from(diskStore.values()));
    fs.writeFileSync(
      DISK_FILE,
      JSON.stringify({ updated_at: Date.now(), orders: serialized }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.warn("[orderStore] gagal menulis disk store:", err.message);
  }
};

const persistKV = async (order) => {
  if (!order?.order_id) return;
  const client = loadKvClient();
  if (!client) return;
  try {
    const key = `order:${order.order_id}`;
    await client.set(key, order, { ex: ORDER_TTL_SECONDS });
    await client.zadd(ORDER_INDEX_KEY, {
      score: resolveOrderScore(order),
      member: order.order_id,
    });
    await client.expire(ORDER_INDEX_KEY, ORDER_TTL_SECONDS);

    if (ORDER_HISTORY_LIMIT > 0) {
      const total = await client.zcard(ORDER_INDEX_KEY);
      const overflow = total - ORDER_HISTORY_LIMIT;
      if (overflow > 0) {
        const obsoleteIds = await client.zrange(ORDER_INDEX_KEY, 0, overflow - 1);
        if (obsoleteIds?.length) {
          await client.zrem(ORDER_INDEX_KEY, ...obsoleteIds);
          await client.del(...obsoleteIds.map((id) => `order:${id}`));
          obsoleteIds.forEach((id) => memStore.delete(id));
          ensureDiskLoaded();
          obsoleteIds.forEach((id) => diskStore.delete(id));
        }
      }
    }
  } catch (err) {
    console.warn("[orderStore] kv.persist gagal:", err.message);
  }
};

const fetchFromDisk = (orderId) => {
  if (!hasDiskStore || !orderId) return null;
  ensureDiskLoaded();
  return diskStore.get(orderId) || null;
};

const fetchFromKV = async (orderId) => {
  const client = loadKvClient();
  if (!client || !orderId) return null;
  try {
    const raw = await client.get(`order:${orderId}`);
    if (!raw) return null;
    const order = decodeOrder(raw);
    if (order?.order_id) {
      memStore.set(order.order_id, order);
      persistDisk(order);
    }
    return order;
  } catch (err) {
    console.warn("[orderStore] kv.get gagal:", err.message);
    return null;
  }
};

const listFromDisk = () => {
  if (!hasDiskStore) return [];
  ensureDiskLoaded();
  return Array.from(diskStore.values());
};

const listFromKV = async () => {
  const client = loadKvClient();
  if (!client) return [];
  try {
    const ids = await client.zrange(ORDER_INDEX_KEY, 0, -1, { rev: true });
    if (!ids?.length) return [];
    const keys = ids.map((id) => `order:${id}`);
    const rows = await client.mget(...keys);
    return rows.map((row) => decodeOrder(row)).filter((order) => order?.order_id);
  } catch (err) {
    console.warn("[orderStore] kv.list gagal:", err.message);
    return [];
  }
};

const mergeOrders = (...lists) => {
  const merged = new Map();
  lists
    .filter(Boolean)
    .forEach((list) => {
      list
        .filter((order) => order?.order_id)
        .forEach((order) => {
          if (!merged.has(order.order_id)) merged.set(order.order_id, order);
        });
    });
  return trimHistory(Array.from(merged.values())).sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a));
};

async function saveOrder(order) {
  if (!order || !order.order_id) return null;
  memStore.set(order.order_id, order);
  persistDisk(order);
  await persistKV(order);
  return order;
}

async function getOrder(orderId) {
  if (!orderId) return null;
  if (memStore.has(orderId)) return memStore.get(orderId);

  const diskOrder = fetchFromDisk(orderId);
  if (diskOrder) return diskOrder;

  return fetchFromKV(orderId);
}

async function listOrders() {
  const memoryOrders = Array.from(memStore.values());
  const diskOrders = listFromDisk();
  const kvOrders = await listFromKV();
  return mergeOrders(kvOrders, diskOrders, memoryOrders);
}

module.exports = {
  saveOrder,
  getOrder,
  listOrders,
};
