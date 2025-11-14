// backend/routes/order/orderStore.js
const path = require("path");
const { kv } = require("@vercel/kv");

let Database = null;
try {
  // eslint-disable-next-line global-require
  Database = require("better-sqlite3");
} catch (err) {
  Database = null;
  console.warn("[orderStore] better-sqlite3 tidak tersedia:", err.message);
}

const STORE_KEY = "__putristore_orders";
const ORDER_INDEX_KEY = "__putristore_order_index";
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari
const DEFAULT_HISTORY_LIMIT = 500;
const envHistoryLimit =
  Number(process.env.ADMIN_HISTORY_LIMIT ?? process.env.ADMIN_MAX_ORDERS ?? DEFAULT_HISTORY_LIMIT);
const ORDER_HISTORY_LIMIT =
  Number.isFinite(envHistoryLimit) && envHistoryLimit > 0 ? envHistoryLimit : DEFAULT_HISTORY_LIMIT;
const SQLITE_PATH =
  process.env.ORDER_DB_PATH || path.join(__dirname, "..", "..", "data.sqlite");

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
    order.payment?.reported_at ||
    order.payment?.uploaded_at;
  const score = candidate ? Date.parse(candidate) : NaN;
  return Number.isFinite(score) ? score : Date.now();
};

let sqlite = null;
let sqliteReady = false;

function getSqlite() {
  if (sqliteReady) return sqlite;
  sqliteReady = true;
  if (!Database) return null;
  try {
    sqlite = new Database(SQLITE_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_orders (
          order_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          created_at TEXT
        )`
      )
      .run();
    sqlite.prepare("CREATE INDEX IF NOT EXISTS idx_admin_orders_updated ON admin_orders(updated_at DESC)").run();
  } catch (err) {
    console.warn("[orderStore] sqlite tidak siap:", err.message);
    sqlite = null;
  }
  return sqlite;
}

async function persistKV(order) {
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
    console.warn("[orderStore] kv.persist gagal:", err.message);
  }
}

function persistSqlite(order) {
  if (!order?.order_id) return;
  const db = getSqlite();
  if (!db) return;
  try {
    const payload = JSON.stringify(order);
    const updated = resolveOrderScore(order);
    db.prepare(
      `INSERT INTO admin_orders (order_id, payload, updated_at, created_at)
       VALUES (@order_id, @payload, @updated_at, COALESCE(@created_at, CURRENT_TIMESTAMP))
       ON CONFLICT(order_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
    ).run({
      order_id: order.order_id,
      payload,
      updated_at: updated,
      created_at: order.created_at || null,
    });

    if (ORDER_HISTORY_LIMIT > 0) {
      db.prepare(
        `DELETE FROM admin_orders
         WHERE order_id IN (
           SELECT order_id FROM admin_orders
           ORDER BY updated_at DESC
           LIMIT -1 OFFSET ?
         )`
      ).run(ORDER_HISTORY_LIMIT);
    }
  } catch (err) {
    console.warn("[orderStore] sqlite.persist gagal:", err.message);
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
    console.warn("[orderStore] kv.get gagal:", err.message);
    return null;
  }
}

function fetchFromSqlite(orderId) {
  if (!orderId) return null;
  const db = getSqlite();
  if (!db) return null;
  try {
    const row = db.prepare("SELECT payload FROM admin_orders WHERE order_id = ?").get(orderId);
    if (!row?.payload) return null;
    const order = decodeOrder(row.payload);
    if (order?.order_id) {
      memStore.set(order.order_id, order);
    }
    return order;
  } catch (err) {
    console.warn("[orderStore] sqlite.get gagal:", err.message);
    return null;
  }
}

function listFromSqlite() {
  const db = getSqlite();
  if (!db) return [];
  try {
    const rows = db
      .prepare("SELECT payload FROM admin_orders ORDER BY updated_at DESC LIMIT ?")
      .all(ORDER_HISTORY_LIMIT);
    return rows
      .map((row) => decodeOrder(row?.payload))
      .filter((order) => order?.order_id);
  } catch (err) {
    console.warn("[orderStore] sqlite.list gagal:", err.message);
    return [];
  }
}

async function saveOrder(order) {
  if (!order || !order.order_id) return null;
  memStore.set(order.order_id, order);
  await persistKV(order);
  persistSqlite(order);
  return order;
}

async function getOrder(orderId) {
  if (!orderId) return null;
  if (memStore.has(orderId)) return memStore.get(orderId);
  const kvOrder = await fetchFromKV(orderId);
  if (kvOrder) return kvOrder;
  return fetchFromSqlite(orderId);
}

async function listOrders() {
  const localOrders = Array.from(memStore.values());
  const sqliteOrders = listFromSqlite();

  if (!hasKV) {
    const merged = new Map();
    sqliteOrders.forEach((order) => merged.set(order.order_id, order));
    localOrders.forEach((order) => {
      if (order?.order_id && !merged.has(order.order_id)) merged.set(order.order_id, order);
    });
    return Array.from(merged.values()).sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a));
  }

  try {
    const ids = await kv.zrange(ORDER_INDEX_KEY, 0, -1, { rev: true });
    if (!ids?.length) {
      return sqliteOrders.length ? sqliteOrders : localOrders;
    }

    const keys = ids.map((id) => `order:${id}`);
    const rawEntries = keys.length ? await kv.mget(...keys) : [];
    const remoteOrders = rawEntries
      .map((entry) => decodeOrder(entry))
      .filter((order) => order?.order_id);

    const merged = new Map(
      remoteOrders.map((order) => [order.order_id, order])
    );
    sqliteOrders.forEach((order) => {
      if (order?.order_id && !merged.has(order.order_id)) merged.set(order.order_id, order);
    });
    localOrders.forEach((order) => {
      if (order?.order_id && !merged.has(order.order_id)) merged.set(order.order_id, order);
    });

    return Array.from(merged.values())
      .filter((order) => order?.order_id)
      .sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a));
  } catch (err) {
    console.warn("[orderStore] kv.listOrders gagal:", err.message);
    return sqliteOrders.length ? sqliteOrders : localOrders;
  }
}

module.exports = {
  saveOrder,
  getOrder,
  listOrders,
};
