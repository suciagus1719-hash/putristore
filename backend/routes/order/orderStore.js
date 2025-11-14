// backend/routes/order/orderStore.js
const fs = require("fs");
const path = require("path");

let Database = null;
try {
  // eslint-disable-next-line global-require
  Database = require("better-sqlite3");
} catch (err) {
  Database = null;
  console.warn("[orderStore] better-sqlite3 tidak tersedia:", err.message);
}

const STORE_KEY = "__putristore_orders";
const ORDER_HISTORY_LIMIT = Math.max(Number(process.env.ADMIN_HISTORY_LIMIT || 500), 100);
const DB_PATH = process.env.ORDER_DB_PATH || path.resolve(process.cwd(), "data.sqlite");

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
    order.timeline?.admin_reviewed_at ||
    order.timeline?.proof_uploaded_at ||
    order.timeline?.pending_payment_at ||
    order.payment?.uploaded_at ||
    order.payment?.reported_at ||
    order.created_at;
  const score = candidate ? Date.parse(candidate) : NaN;
  return Number.isFinite(score) ? score : Date.now();
};

let sqlite = null;
let sqliteReady = false;

function initSqlite() {
  if (sqliteReady) return sqlite;
  sqliteReady = true;
  if (!Database) return null;

  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    sqlite = new Database(DB_PATH);
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

function persistSqlite(order) {
  if (!order?.order_id) return;
  const db = initSqlite();
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

function fetchFromSqlite(orderId) {
  if (!orderId) return null;
  const db = initSqlite();
  if (!db) return null;
  try {
    const row = db.prepare("SELECT payload FROM admin_orders WHERE order_id = ?").get(orderId);
    if (!row?.payload) return null;
    return decodeOrder(row.payload);
  } catch (err) {
    console.warn("[orderStore] sqlite get gagal:", err.message);
    return null;
  }
}

function listFromSqlite() {
  const db = initSqlite();
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

async function saveOrder(order) {
  if (!order || !order.order_id) return null;
  memStore.set(order.order_id, order);
  persistSqlite(order);
  return order;
}

async function getOrder(orderId) {
  if (!orderId) return null;
  if (memStore.has(orderId)) return memStore.get(orderId);
  const sqliteOrder = fetchFromSqlite(orderId);
  if (sqliteOrder) {
    memStore.set(orderId, sqliteOrder);
  }
  return sqliteOrder;
}

async function listOrders() {
  const memoryOrders = Array.from(memStore.values());
  const sqliteOrders = listFromSqlite();

  if (!sqliteOrders.length) {
    return memoryOrders.sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a));
  }

  const merged = new Map();
  sqliteOrders.forEach((order) => merged.set(order.order_id, order));
  memoryOrders.forEach((order) => {
    if (order?.order_id && !merged.has(order.order_id)) merged.set(order.order_id, order);
  });

  return Array.from(merged.values()).sort((a, b) => resolveOrderScore(b) - resolveOrderScore(a));
}

module.exports = {
  saveOrder,
  getOrder,
  listOrders,
};
