const express = require("express");
const multer = require("multer");
const fetch = global.fetch || require("node-fetch");
const applyCors = require("./cors");
const { saveOrder, getOrder, listOrders } = require("./orderStore");

const router = express.Router();

router.use((req, res, next) => {
  if (applyCors(req, res)) return;
  next();
});

const REVIEW_DEADLINE_MS = 24 * 60 * 60 * 1000; // 1x24 jam
const PAYMENT_WINDOW_MINUTES = Math.max(Number(process.env.PAYMENT_WINDOW_MINUTES || 30), 5);
const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;
const PAYMENT_PROOF_EMAIL = process.env.PAYMENT_PROOF_EMAIL || process.env.ADMIN_EMAIL || null;

// penyimpanan bukti (in-memory -> disimpan sebagai data URL pada order)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

async function cacheOrder(order) {
  if (!order?.order_id) return;
  await saveOrder(order);
}

async function enforceReviewDeadline(order) {
  if (!order) return null;
  if (
    ["waiting_review", "waiting_payment_proof"].includes(order.status) &&
    order.review_deadline &&
    Date.now() > Date.parse(order.review_deadline)
  ) {
    order.status = "cancelled";
    order.auto_cancelled = true;
    order.cancel_reason = "review_timeout";
    order.cancelled_at = new Date().toISOString();
    order.review_deadline = null;
    await cacheOrder(order);
  }
  return order;
}

async function loadOrder(orderId) {
  if (!orderId) return null;
  const order = await getOrder(orderId);
  return enforceReviewDeadline(order);
}

async function loadAllOrders() {
  const rows = await listOrders();
  return Promise.all(rows.map((order) => enforceReviewDeadline(order)));
}

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function decodeMaybeBase64(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return value;
  try {
    const buffer = Buffer.from(trimmed, "base64");
    const decoded = buffer.toString("utf8");
    return decoded;
  } catch {
    return value;
  }
}

function parseSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const candidate = decodeMaybeBase64(raw);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw;
  return null;
}

function normalizeOrderSnapshot(snapshot, fallbackOrderId) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const order_id = String(snapshot.order_id || fallbackOrderId || "").trim();
  if (!order_id) return null;
  const nowIso = new Date().toISOString();
  const customer = snapshot.customer || {};
  const payment = snapshot.payment || {};
  const price = snapshot.price || {};
  const quantity = Number(snapshot.quantity) || 0;
  const total = toNum(price.total ?? payment.amount ?? snapshot.total_price ?? snapshot.price_total);
  return {
    order_id,
    service_id: String(snapshot.service_id || "").trim(),
    service_name: snapshot.service_name ? String(snapshot.service_name).trim() : null,
    platform: snapshot.platform ? String(snapshot.platform).trim() : null,
    category: snapshot.category ? String(snapshot.category).trim() : null,
    quantity,
    target: String(snapshot.target || "").trim(),
    customer: {
      name: String(customer.name || "").trim(),
      phone: String(customer.phone || "").trim(),
      email: String(customer.email || "").trim(),
    },
    notes: snapshot.notes ? String(snapshot.notes).trim() : null,
    status: snapshot.status || "pending_payment",
    created_at: snapshot.created_at || nowIso,
    hold_until: snapshot.hold_until || null,
    review_deadline: snapshot.review_deadline || null,
    price: {
      unit: toNum(price.unit ?? snapshot.unit_price),
      total,
      currency: price.currency || "IDR",
    },
    payment: {
      method: payment.method || null,
      amount: toNum(payment.amount ?? total),
      proof_url: payment.proof_url || null,
      proof_status: payment.proof_status || "missing",
      proof_channel: payment.proof_channel || "upload",
      fallback_email: payment.fallback_email || PAYMENT_PROOF_EMAIL,
      uploaded_at: payment.uploaded_at || null,
      reported_at: payment.reported_at || null,
      expires_at: payment.expires_at || snapshot.hold_until || null,
      notes: payment.notes || null,
    },
    timeline: snapshot.timeline || {},
    auto_cancelled: snapshot.auto_cancelled || false,
    cancel_reason: snapshot.cancel_reason || null,
  };
}

async function resolveOrder(orderId, snapshotRaw, payloadRaw) {
  const primary = parseSnapshot(snapshotRaw);
  const fallbackPayload = primary || parseSnapshot(payloadRaw);
  const normalized = normalizeOrderSnapshot(primary || fallbackPayload, orderId);
  if (normalized) {
    await cacheOrder(normalized);
    return normalized;
  }
  if (!orderId) return null;
  return loadOrder(orderId);
}

// helper bikin ID
const createOrderId = () => `ORD-${Date.now().toString(36).toUpperCase()}`;

// Env panel
const PANEL_API_URL =
  process.env.SMMPANEL_BASE_URL ||
  process.env.PANEL_API_URL ||
  "https://pusatpanelsmm.com/api/json.php";
const PANEL_KEY = process.env.SMMPANEL_API_KEY;
const PANEL_SECRET = process.env.SMMPANEL_SECRET;

async function pushOrderToPanel(order) {
  if (!PANEL_KEY || !PANEL_SECRET) {
    return { ok: false, message: "ENV panel belum diset" };
  }

  const basePayload = {
    api_key: PANEL_KEY,
    secret_key: PANEL_SECRET,
    action: "add",
    service: String(order.service_id),
    link: String(order.target),
    quantity: String(order.quantity),
  };

  const tryCall = async (headers, body) => {
    const resp = await fetch(PANEL_API_URL, {
      method: "POST",
      headers,
      body,
    });
    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { resp, json, raw: text };
  };

  try {
    // pertama: form-urlencoded
    let { resp, json, raw } = await tryCall(
      {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      new URLSearchParams(basePayload)
    );

    if (!resp.ok || !json || json.status !== true || !json.data?.id) {
      ({ resp, json, raw } = await tryCall(
        {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        JSON.stringify({
          ...basePayload,
          service: Number(order.service_id),
          quantity: Number(order.quantity),
        })
      ));

      if (!resp.ok || !json || json.status !== true || !json.data?.id) {
        return {
          ok: false,
          message: "Panel menolak order",
          detail: json || raw,
        };
      }
    }

    return { ok: true, provider_order_id: String(json.data.id), raw: json };
  } catch (e) {
    return { ok: false, message: e.message || "Gagal konek panel" };
  }
}

// checkout — hanya simpan, status pending_payment
router.post("/order/checkout", async (req, res) => {
  const {
    service_id,
    quantity,
    target,
    customer = {},
    platform,
    category,
    service_name,
    unit_price,
    total_price,
    price_total,
    payment_email,
  } = req.body || {};

  const normalizedQuantity = Number(quantity);
  if (!service_id || !target || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return res.status(422).json({ ok: false, message: "Data tidak lengkap" });
  }

  const total = toNum(total_price ?? price_total);
  const unit = toNum(unit_price);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS).toISOString();
  const paymentContact = String(payment_email || "").trim() || PAYMENT_PROOF_EMAIL || null;

  const order_id = createOrderId();
  const order = {
    order_id,
    service_id: String(service_id),
    service_name: service_name ? String(service_name).trim() : null,
    platform: platform ? String(platform).trim() : null,
    category: category ? String(category).trim() : null,
    quantity: normalizedQuantity,
    target: String(target).trim(),
    customer: {
      name: String(customer.name || "").trim(),
      phone: String(customer.phone || "").trim(),
      email: String(customer.email || "").trim(),
    },
    notes: String(req.body.notes || "").trim() || null,
    status: "pending_payment",
    created_at: now.toISOString(),
    hold_until: expiresAt,
    review_deadline: null,
    price: {
      unit,
      total,
      currency: "IDR",
    },
    payment: {
      method: null,
      amount: total,
      proof_url: null,
      proof_status: "missing",
      proof_channel: "upload",
      fallback_email: paymentContact,
      uploaded_at: null,
      reported_at: null,
      expires_at: expiresAt,
      notes: null,
    },
    timeline: {
      pending_payment_at: now.toISOString(),
    },
  };
  await cacheOrder(order);
  return res.json({ ok: true, order });
});

// pilih metode bayar + nominal
router.post("/order/payment-method", async (req, res) => {
  const {
    order_id,
    method,
    amount,
    proof_channel = "upload",
    notes,
    fallback_email,
    order_snapshot,
    order_payload,
  } = req.body || {};

  const order = await resolveOrder(order_id, order_snapshot, order_payload);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  if (["cancelled", "rejected"].includes(order.status)) {
    return res.status(409).json({ ok: false, message: "Order sudah tidak aktif" });
  }
  if (!method && !order.payment?.method) {
    return res.status(422).json({ ok: false, message: "Metode pembayaran wajib dipilih" });
  }

  const finalAmount = toNum(amount) ?? order.price?.total ?? order.payment?.amount ?? null;
  const now = new Date();
  const reviewDeadline = new Date(now.getTime() + REVIEW_DEADLINE_MS).toISOString();
  const proofChannel = (proof_channel || "upload").toLowerCase();
  const normalizedNotes = String(notes || "").trim();

  order.payment = {
    ...(order.payment || {}),
    method: method || order.payment?.method,
    amount: finalAmount,
    notes: normalizedNotes || order.payment?.notes || null,
    reported_at: now.toISOString(),
    proof_channel: proofChannel,
    fallback_email: String(fallback_email || "").trim() || order.payment?.fallback_email || PAYMENT_PROOF_EMAIL,
  };
  order.payment.proof_status = order.payment.proof_url
    ? "uploaded"
    : proofChannel === "email"
    ? "awaiting_email"
    : "pending_upload";

  order.status = "waiting_review";
  order.review_deadline = reviewDeadline;
  order.timeline = {
    ...(order.timeline || {}),
    payment_reported_at: order.payment.reported_at,
  };

  await cacheOrder(order);
  return res.json({ ok: true, order });
});

// upload bukti transfer
router.post("/order/upload-proof", upload.single("proof"), async (req, res) => {
  const { order_id, order_snapshot, order_payload } = req.body || {};
  const order = await resolveOrder(order_id, order_snapshot, order_payload);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  if (!req.file) return res.status(400).json({ ok: false, message: "Bukti wajib diupload" });

  order.payment = order.payment || {};
  const mime = req.file.mimetype || "application/octet-stream";
  const base64 = req.file.buffer?.toString("base64") || "";
  order.payment.proof_url = base64 ? `data:${mime};base64,${base64}` : null;
  order.payment.proof_file_name = req.file.originalname || null;
  order.payment.proof_mime = mime;
  order.payment.proof_size = req.file.size || null;
  order.payment.uploaded_at = new Date().toISOString();
  order.payment.proof_status = "uploaded";
  order.payment.proof_channel = "upload";
  order.status = "waiting_review";
  if (!order.review_deadline) {
    order.review_deadline = new Date(Date.now() + REVIEW_DEADLINE_MS).toISOString();
  }
  order.timeline = {
    ...(order.timeline || {}),
    proof_uploaded_at: order.payment.uploaded_at,
  };
  await cacheOrder(order);
  return res.json({ ok: true, order });
});

// admin: auth sederhana pakai header
router.use("/admin", (req, res, next) => {
  const token = req.headers["x-admin-key"];
  if (token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
});

// admin: list order
router.get("/admin/orders", async (_, res) => {
  const orders = await loadAllOrders();
  return res.json(orders);
});

// admin: update status
router.post("/admin/orders/:orderId/status", async (req, res) => {
  const order = await loadOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, message: "Tidak ada" });
  const requestedStatus = String(req.body.status || order.status || "").trim();
  const nextStatus = requestedStatus || order.status;
  order.admin_note = String(req.body.admin_note || "").trim() || null;

  if (nextStatus === "approved" && !order.provider_order_id) {
    const panelResult = await pushOrderToPanel(order);
    if (!panelResult.ok) {
      return res.status(502).json({
        ok: false,
        message: panelResult.message || "Gagal teruskan ke panel",
        detail: panelResult.detail,
      });
    }
    order.provider_order_id = panelResult.provider_order_id;
  }

  order.status = nextStatus;
  if (["approved", "rejected", "cancelled"].includes(nextStatus)) {
    order.review_deadline = null;
  }
  const now = new Date().toISOString();
  order.timeline = {
    ...(order.timeline || {}),
    admin_reviewed_at: now,
    ...(nextStatus === "approved" ? { approved_at: now } : {}),
    ...(nextStatus === "rejected" ? { rejected_at: now } : {}),
    ...(nextStatus === "cancelled" ? { cancelled_at: now } : {}),
  };
  await cacheOrder(order);

  return res.json({ ok: true, order });
});

router.get("/order/status", async (req, res) => {
  try {
    const order_id = String(req.query.order_id || "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });

    const local = (await loadOrder(order_id)) || null;
    const hasPanelEnv = Boolean(PANEL_KEY && PANEL_SECRET);
    const respondLocal = (panelStatus = null) => {
      const baseStatus = panelStatus || {};
      const preferredStatus = local?.status || baseStatus.status || "unknown";
      return res.json({
        order_id,
        status: preferredStatus,
        start_count: baseStatus.start_count ?? null,
        remains: baseStatus.remains ?? null,
        charge: baseStatus.charge ?? local?.price?.total ?? null,
        panel_status: baseStatus.status ?? null,
        target: local?.target ?? null,
        service_name: local?.service_name ?? null,
        quantity: local?.quantity ?? null,
        provider_order_id: local?.provider_order_id ?? null,
        created_at: local?.created_at ?? null,
        review_deadline: local?.review_deadline ?? null,
        payment: local?.payment ?? null,
      });
    };

    if (!hasPanelEnv && !local) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    if (!hasPanelEnv || (local && !local.provider_order_id)) {
      return respondLocal();
    }

    const lookupId = local?.provider_order_id || order_id;
    const basePayload = {
      api_key: PANEL_KEY,
      secret_key: PANEL_SECRET,
      action: "status",
      id: lookupId,
    };

    const tryCall = async (headers, body) => {
      const resp = await fetch(PANEL_API_URL, {
        method: "POST",
        headers,
        body,
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { resp, json, raw: text };
    };

    let { resp, json, raw } = await tryCall(
      {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      new URLSearchParams(basePayload)
    );

    const looksIdMissing = String(raw || "").toLowerCase().includes("id required");
    if (!resp.ok || !json || json.status !== true || looksIdMissing) {
      ({ resp, json, raw } = await tryCall(
        {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        JSON.stringify({ ...basePayload, id: Number(lookupId) })
      ));
    }

    if (!json || json.status !== true) {
      if (local) return respondLocal();
      return res.status(502).json({
        message: json?.data?.msg || json?.error || "Gagal mengambil status",
        raw: json || raw,
      });
    }

    const data = json.data || {};
    const panelStatus = {
      status: data.status ?? "unknown",
      start_count: toNum(data.start_count),
      remains: toNum(data.remains ?? data.remain),
      charge: toNum(data.charge ?? data.price ?? data.harga),
    };

    return respondLocal(panelStatus);
  } catch (err) {
    console.error("status error:", err);
    res.status(500).json({ message: String(err?.message || err) });
  }
});

module.exports = router;
