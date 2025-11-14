// backend/routes/order/orderStore.js
const fs = require("fs");
const os = require("os");
const path = require("path");

let Database = null;
try {
  // eslint-disable-next-line global-require
  Database = require("better-sqlite3");
} catch (err) {
  Database = null;
  console.warn("[orderStore] better-sqlite3 tidak tersedia:", err.message);
}

const hasKvEnv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
let kvClient = null;
let kvReady = false;

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
const JSON_DIR =
  process.env.ORDER_JSON_DIR ||
  path.join(os.tmpdir(), "putristore-orders");
const JSON_FILE = path.join(JSON_DIR, "orders.json");

const memStore = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = memStore;

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

const trimHistory = (orders) => {
  if (!Array.isArray(orders)) return [];
  if (orders.length <= ORDER_HISTORY_LIMIT) return orders;
  return orders
    .sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a))
    .slice(0, ORDER_HISTORY_LIMIT);
};

function getKv() {
  if (!hasKvEnv) return null;
  if (kvReady) return kvClient;
  kvReady = true;
  try {
    ({ kv: kvClient } = require("@vercel/kv"));
  } catch (err) {
    kvClient = null;
    console.warn("[orderStore] gagal memuat @vercel/kv:", err.message);
  }
  return kvClient;
}

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
    sqlite = null;
    console.warn("[orderStore] sqlite tidak siap:", err.message);
  }
  return sqlite;
}

let jsonReady = false;
let jsonAvailable = false;
const jsonStore = new Map();

function ensureJsonLoaded() {
  if (jsonReady) return jsonAvailable;
  jsonReady = true;
  try {
    fs.mkdirSync(JSON_DIR, { recursive: true });
    jsonAvailable = true;
    if (fs.existsSync(JSON_FILE)) {
      const raw = fs.readFileSync(JSON_FILE, "utf8");
      const parsed = JSON.parse(raw || "{}");
      const list = Array.isArray(parsed) ? parsed : parsed.orders || [];
      list
        .map((entry) => decodeOrder(entry))
        .filter((order) => order?.order_id)
        .forEach((order) => {
          jsonStore.set(order.order_id, order);
          memStore.set(order.order_id, order);
        });
    }
  } catch (err) {
    jsonAvailable = false;
    console.warn("[orderStore] json fallback tidak siap:", err.message);
  }
  return jsonAvailable;
}

function persistJson(order) {
  if (!order?.order_id) return;
  if (!ensureJsonLoaded()) return;
  try {
    jsonStore.set(order.order_id, order);
    const serialized = trimHistory(Array.from(jsonStore.values()));
    fs.writeFileSync(
      JSON_FILE,
      JSON.stringify({ updated_at: Date.now(), orders: serialized }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.warn("[orderStore] json persist gagal:", err.message);
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
    console.warn("[orderStore] sqlite persist gagal:", err.message);
  }
}

async function persistKv(order) {
  if (!order?.order_id) return;
  const kv = getKv();
  if (!kv) return;
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
          if (jsonAvailable) {
            ensureJsonLoaded();
            obsoleteIds.forEach((id) => jsonStore.delete(id));
          }
        }
      }
    }
  } catch (err) {
    console.warn("[orderStore] kv persist gagal:", err.message);
  }
}

async function fetchFromKv(orderId) {
  if (!orderId) return null;
  const kv = getKv();
  if (!kv) return null;
  try {
    const raw = await kv.get(`order:${orderId}`);
    if (!raw) return null;
    const order = decodeOrder(raw);
    if (order?.order_id) {
      memStore.set(order.order_id, order);
      persistJson(order);
      persistSqlite(order);
    }
    return order;
  } catch (err) {
    console.warn("[orderStore] kv get gagal:", err.message);
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
      persistJson(order);
    }
    return order;
  } catch (err) {
    console.warn("[orderStore] sqlite get gagal:", err.message);
    return null;
  }
}

function fetchFromJson(orderId) {
  if (!orderId) return null;
  if (!ensureJsonLoaded()) return null;
  return jsonStore.get(orderId) || null;
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
    console.warn("[orderStore] sqlite list gagal:", err.message);
    return [];
  }
}

function listFromJson() {
  if (!ensureJsonLoaded()) return [];
  return Array.from(jsonStore.values());
}

async function listFromKv() {
  const kv = getKv();
  if (!kv) return [];
  try {
    const ids = await kv.zrange(ORDER_INDEX_KEY, 0, -1, { rev: true });
    if (!ids?.length) return [];
    const keys = ids.map((id) => `order:${id}`);
    const rawEntries = keys.length ? await kv.mget(...keys) : [];
    return rawEntries
      .map((entry) => decodeOrder(entry))
      .filter((order) => order?.order_id);
  } catch (err) {
    console.warn("[orderStore] kv list gagal:", err.message);
    return [];
  }
}

function mergeOrders(...lists) {
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
  return trimHistory(Array.from(merged.values()));
}

async function saveOrder(order) {
  if (!order || !order.order_id) return null;
  memStore.set(order.order_id, order);
  persistJson(order);
  persistSqlite(order);
  await persistKv(order);
  return order;
}

async function getOrder(orderId) {
  if (!orderId) return null;
  if (memStore.has(orderId)) return memStore.get(orderId);
  const sqliteOrder = fetchFromSqlite(orderId);
  if (sqliteOrder) return sqliteOrder;
  const jsonOrder = fetchFromJson(orderId);
  if (jsonOrder) return jsonOrder;
  return fetchFromKv(orderId);
}

async function listOrders() {
  const memoryOrders = Array.from(memStore.values());
  const sqliteOrders = listFromSqlite();
  const jsonOrders = listFromJson();
  const kvOrders = await listFromKv();
  return mergeOrders(kvOrders, sqliteOrders, jsonOrders, memoryOrders).sort(
    (a, b) => resolveOrderScore(b) - resolveOrderScore(a)
  );
}

module.exports = {
  saveOrder,
  getOrder,
  listOrders,
};
