const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { put } = require("@vercel/blob");
const fetch = global.fetch || require("node-fetch");
const applyCors = require("./cors");
const { saveOrder, getOrder, listOrders } = require("./orderStore");
const {
  saveManualCatalog,
  forceRefreshCatalog,
  readCachedCatalog,
} = require("../../utils/serviceCatalog");
const {
  isConfigured: isDuitkuConfigured,
  getConfig: getDuitkuConfig,
  createHostedInvoice,
  verifyCallbackSignature,
} = require("../../utils/duitku");

const router = express.Router();

router.use((req, res, next) => {
  if (applyCors(req, res)) return;
  next();
});

const REVIEW_DEADLINE_MS = 24 * 60 * 60 * 1000; // 1x24 jam
const PAYMENT_WINDOW_MINUTES = Math.max(Number(process.env.PAYMENT_WINDOW_MINUTES || 30), 5);
const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;
const PAYMENT_PROOF_EMAIL = process.env.PAYMENT_PROOF_EMAIL || process.env.ADMIN_EMAIL || null;
const ADMIN_SECRET = resolveAdminSecret();
if (!ADMIN_SECRET) {
  console.warn("[admin] ADMIN_SECRET tidak diset. Endpoint admin akan ditolak sampai secret tersedia.");
}
const HYDRATION_SECRET =
  process.env.ORDER_SIGN_KEY ||
  ADMIN_SECRET ||
  process.env.SMMPANEL_SECRET ||
  "putristore-hydration-secret";

const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ||
  process.env.BLOB_RW_TOKEN ||
  process.env.VERCEL_BLOB_RW_TOKEN ||
  process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
  null;
const DUITKU_CONFIG = getDuitkuConfig();
const DUITKU_ENABLED = isDuitkuConfigured();

const WHATSAPP_WEBHOOK_URL =
  process.env.NOTIFY_WHATSAPP_URL ||
  process.env.WHATSAPP_WEBHOOK_URL ||
  process.env.WHATSAPP_NOTIFY_URL ||
  null;
const WHATSAPP_WEBHOOK_TOKEN =
  process.env.NOTIFY_WHATSAPP_TOKEN ||
  process.env.WHATSAPP_WEBHOOK_TOKEN ||
  process.env.WHATSAPP_NOTIFY_TOKEN ||
  null;
const EMAIL_WEBHOOK_URL = process.env.NOTIFY_EMAIL_URL || process.env.EMAIL_WEBHOOK_URL || null;

// penyimpanan bukti (in-memory -> disimpan sebagai data URL pada order)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

const sanitizeFileName = (value) =>
  String(value || "proof")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || `proof-${Date.now()}`;

async function normalizeProofBuffer(file) {
  const baseBuffer = file?.buffer || Buffer.from([]);
  const baseName = sanitizeFileName(file?.originalname || "proof");
  if (!baseBuffer.length) {
    return { buffer: baseBuffer, mime: file?.mimetype || "application/octet-stream", baseName };
  }
  try {
    const buffer = await sharp(baseBuffer).rotate().jpeg({ quality: 70 }).toBuffer();
    return { buffer, mime: "image/jpeg", baseName: `${baseName}.jpg` };
  } catch (err) {
    console.warn("sharp convert failed:", err.message);
    return { buffer: baseBuffer, mime: file?.mimetype || "application/octet-stream", baseName };
  }
}

async function storeProofExternally(buffer, { orderId, fileName, contentType }) {
  if (!BLOB_TOKEN) {
    return { ok: false, message: "BLOB_READ_WRITE_TOKEN belum diset" };
  }
  const safeKey = `proofs/${sanitizeFileName(orderId)}-${Date.now()}-${fileName || "proof.jpg"}`;
  try {
    const { url } = await put(safeKey, buffer, {
      access: "public",
      contentType: contentType || "application/octet-stream",
      token: BLOB_TOKEN,
    });
    return { ok: true, url };
  } catch (err) {
    console.error("blob upload failed:", err);
    return { ok: false, message: err.message || "Upload gagal" };
  }
}

function readSecretFile(candidatePath) {
  if (!candidatePath) return "";
  try {
    const resolved = path.isAbsolute(candidatePath)
      ? candidatePath
      : path.resolve(process.cwd(), candidatePath);
    if (!fs.existsSync(resolved)) return "";
    return fs.readFileSync(resolved, "utf8").trim();
  } catch {
    return "";
  }
}

function resolveAdminSecret() {
  const fallbackFiles =
    process.env.NODE_ENV === "production"
      ? [process.env.ADMIN_SECRET_FILE]
      : [
          process.env.ADMIN_SECRET_FILE,
          path.resolve(process.cwd(), "tmp_admin_secret.txt"),
          path.resolve(__dirname, "../../../tmp_admin_secret.txt"),
        ];

  const candidates = [
    process.env.ADMIN_SECRET,
    process.env.ADMIN_KEY,
    process.env.ADMIN_TOKEN,
    ...fallbackFiles.map((filePath) => readSecretFile(filePath)),
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

async function cacheOrder(order) {
  if (!order?.order_id) return;
  order.hydration_token = order.hydration_token || encodeHydrationToken(order);
  await saveOrder(order);
}

const buildStatusMessage = (order) => {
  const baseService = order.service_name || `Layanan #${order.service_id || "-"}`;
  const base =
    order.status === "approved"
      ? `Pesanan ${order.order_id} sudah di-approve dan diteruskan ke panel.`
      : order.status === "rejected"
      ? `Pesanan ${order.order_id} ditolak. Silakan hubungi admin.`
      : order.status === "waiting_review"
      ? `Bukti pembayaran untuk pesanan ${order.order_id} sudah kami terima dan sedang direview.`
      : `Status pesanan ${order.order_id}: ${order.status}`;
  return `${base}\nLayanan: ${baseService}\nJumlah: ${order.quantity}\nTarget: ${order.target}`;
};

async function sendWhatsAppNotification(order) {
  if (!WHATSAPP_WEBHOOK_URL || !order?.customer?.phone) return;
  try {
    await fetch(WHATSAPP_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WHATSAPP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${WHATSAPP_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        phone: order.customer.phone,
        message: buildStatusMessage(order),
        order_id: order.order_id,
        status: order.status,
      }),
    });
  } catch (err) {
    console.warn("whatsapp notify gagal:", err.message);
  }
}

async function sendEmailNotification(order) {
  if (!EMAIL_WEBHOOK_URL || !order?.customer?.email) return;
  try {
    await fetch(EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order.customer.email,
        subject: `Status Pesanan ${order.order_id}`,
        message: buildStatusMessage(order),
        order_id: order.order_id,
        status: order.status,
      }),
    });
  } catch (err) {
    console.warn("email notify gagal:", err.message);
  }
}

async function dispatchNotifications(order) {
  await Promise.all([sendWhatsAppNotification(order), sendEmailNotification(order)]);
}

async function enforceReviewDeadline(order) {
  if (!order) return null;
  const nowTs = Date.now();
  if (
    order.hold_until &&
    ["pending_payment", "waiting_gateway"].includes(order.status) &&
    nowTs > Date.parse(order.hold_until)
  ) {
    order.status = "cancelled";
    order.auto_cancelled = true;
    order.cancel_reason = "payment_timeout";
    order.cancelled_at = new Date().toISOString();
    order.review_deadline = null;
    await cacheOrder(order);
    return order;
  }
  if (
    ["waiting_review", "waiting_payment_proof"].includes(order.status) &&
    order.review_deadline &&
    nowTs > Date.parse(order.review_deadline)
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

const toBase64Url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (str) => {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (str.length % 4)) % 4);
  return Buffer.from(normalized, "base64");
};

function encodeHydrationToken(order) {
  if (!order?.order_id) return null;
  const payloadObj = {
    order_id: order.order_id,
    service_id: order.service_id,
    service_name: order.service_name || null,
    platform: order.platform || null,
    category: order.category || null,
    quantity: order.quantity,
    target: order.target,
    customer: order.customer || {},
    notes: order.notes || null,
    price: order.price || null,
    payment: order.payment || null,
    created_at: order.created_at || new Date().toISOString(),
  };
  const payload = toBase64Url(JSON.stringify(payloadObj));
  const signature = toBase64Url(crypto.createHmac("sha256", HYDRATION_SECRET).update(payload).digest());
  return `${payload}.${signature}`;
}

function decodeHydrationToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = toBase64Url(crypto.createHmac("sha256", HYDRATION_SECRET).update(payload).digest());
  if (expected !== signature) return null;
  try {
    const json = fromBase64Url(payload).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
    hydration_token: snapshot.hydration_token || null,
  };
}

async function resolveOrder(orderId, snapshotRaw, payloadRaw, token) {
  const primary = parseSnapshot(snapshotRaw);
  const fallbackPayload = primary || parseSnapshot(payloadRaw);
  const normalized = normalizeOrderSnapshot(primary || fallbackPayload, orderId);
  if (normalized) {
    normalized.hydration_token = normalized.hydration_token || encodeHydrationToken(normalized);
    await cacheOrder(normalized);
    return normalized;
  }
  if (!orderId) return null;
  const decoded = decodeHydrationToken(token);
  if (decoded) {
    const rebuilt = normalizeOrderSnapshot(decoded, orderId);
    if (rebuilt) {
      rebuilt.hydration_token = encodeHydrationToken(rebuilt);
      await cacheOrder(rebuilt);
      return rebuilt;
    }
  }
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
  if (DUITKU_ENABLED) {
    try {
      const invoice = await createHostedInvoice(order, {
        amount: total || normalizedQuantity * unit,
        description: order.service_name || `Layanan ${order.service_id}`,
      });
      if (!invoice.ok) {
        return res.status(502).json({
          ok: false,
          message: invoice.message || "Gateway pembayaran tidak tersedia",
          detail: invoice.detail || null,
        });
      }
      const expireMinutes = invoice.payload?.expiryPeriod || PAYMENT_WINDOW_MINUTES;
      const gatewayExpires = new Date(now.getTime() + expireMinutes * 60 * 1000).toISOString();
      order.hold_until = gatewayExpires;
      order.payment = {
        ...(order.payment || {}),
        method: "duitku",
        proof_channel: "gateway",
        proof_status: "gateway_pending",
        expires_at: gatewayExpires,
        gateway: "duitku",
        gateway_mode: DUITKU_CONFIG.mode,
        gateway_status: "pending",
        gateway_reference:
          invoice.response?.reference ||
          invoice.response?.invoiceId ||
          order.order_id,
        gateway_checkout_url: invoice.response?.paymentUrl,
        gateway_response: invoice.response,
      };
      order.notes = order.notes || `Gateway: Duitku (${DUITKU_CONFIG.mode})`;
      order.status = "waiting_gateway";
      order.timeline = {
        ...(order.timeline || {}),
        gateway_invoice_created_at: now.toISOString(),
      };
    } catch (err) {
      return res
        .status(502)
        .json({ ok: false, message: err.message || "Gagal membuat pembayaran" });
    }
  }
  order.hydration_token = encodeHydrationToken(order);
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
    hydration_token,
  } = req.body || {};

  const order = await resolveOrder(order_id, order_snapshot, order_payload, hydration_token);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  if (order.payment?.gateway === "duitku") {
    return res.status(409).json({
      ok: false,
      message: "Order ini menggunakan pembayaran otomatis melalui Duitku.",
    });
  }
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

  order.hydration_token = encodeHydrationToken(order);
  await cacheOrder(order);
  return res.json({ ok: true, order });
});

// upload bukti transfer
router.post("/order/upload-proof", upload.single("proof"), async (req, res) => {
  const { order_id, order_snapshot, order_payload, hydration_token } = req.body || {};
  const order = await resolveOrder(order_id, order_snapshot, order_payload, hydration_token);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  if (order.payment?.gateway === "duitku") {
    return res.status(409).json({
      ok: false,
      message: "Order ini menggunakan pembayaran otomatis melalui Duitku.",
    });
  }
  if (!req.file) return res.status(400).json({ ok: false, message: "Bukti wajib diupload" });

  const prepared = await normalizeProofBuffer(req.file);
  if (!prepared.buffer?.length) {
    return res.status(400).json({ ok: false, message: "File bukti tidak valid" });
  }

  const uploaded = await storeProofExternally(prepared.buffer, {
    orderId: order.order_id,
    fileName: prepared.baseName,
    contentType: prepared.mime,
  });
  if (!uploaded.ok) {
    return res.status(500).json({
      ok: false,
      message: uploaded.message || "Gagal menyimpan bukti. Pastikan BLOB_READ_WRITE_TOKEN sudah diset.",
    });
  }

  order.payment = order.payment || {};
  order.payment.proof_url = uploaded.url;
  order.payment.proof_file_name = prepared.baseName;
  order.payment.proof_mime = prepared.mime;
  order.payment.proof_size = prepared.buffer.length;
  order.payment.proof_storage = "blob_external";
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
  order.hydration_token = encodeHydrationToken(order);
  await cacheOrder(order);
  dispatchNotifications(order).catch((err) => console.warn("notify gagal:", err?.message || err));
  return res.json({ ok: true, order });
});

router.post("/order/duitku-callback", async (req, res) => {
  if (!DUITKU_ENABLED) {
    return res.status(200).send("IGNORED");
  }
  try {
    const payload = typeof req.body === "object" && req.body !== null ? req.body : {};
    const merchantOrderId =
      String(payload.merchantOrderId || payload.merchantOrderID || payload.invoiceNumber || "").trim();
    if (!merchantOrderId) {
      return res.status(400).send("INVALID_ORDER");
    }
    if (!verifyCallbackSignature(payload)) {
      console.warn("[duitku] signature invalid", payload);
      return res.status(400).send("INVALID_SIGNATURE");
    }
    const order = await loadOrder(merchantOrderId);
    if (!order) {
      return res.status(404).send("ORDER_NOT_FOUND");
    }
    const now = new Date().toISOString();
    order.payment = order.payment || {};
    order.payment.gateway = "duitku";
    order.payment.gateway_reference = payload.reference || order.payment.gateway_reference || null;
    order.payment.gateway_payment_code = payload.paymentCode || order.payment.gateway_payment_code || null;
    order.payment.gateway_callback = payload;
    order.payment.gateway_last_callback_at = now;
    const resultCode = String(payload.resultCode || payload.statusCode || "").trim();
    const success = resultCode === "00";
    order.timeline = {
      ...(order.timeline || {}),
      gateway_callback_at: now,
      ...(success ? { gateway_paid_at: now } : {}),
    };
    if (success) {
      order.payment.gateway_status = "paid";
      order.payment.gateway_paid_at = now;
      order.payment.proof_status = "gateway_confirmed";
      order.status = "paid_gateway";
      order.review_deadline = null;
      if (!order.provider_order_id) {
        const panelResult = await pushOrderToPanel(order);
        if (panelResult.ok) {
          const approvedAt = new Date().toISOString();
          order.provider_order_id = panelResult.provider_order_id;
          order.status = "approved";
          order.timeline = {
            ...(order.timeline || {}),
            gateway_forwarded_at: approvedAt,
            approved_at: approvedAt,
          };
        } else {
          order.status = "paid_pending_panel";
          order.panel_forward_error = panelResult.message || "panel_error";
          order.panel_forward_detail = panelResult.detail || null;
        }
      } else if (!order.timeline?.approved_at) {
        order.status = "approved";
        order.timeline = {
          ...(order.timeline || {}),
          approved_at: now,
        };
      } else {
        order.status = order.status === "paid_gateway" ? "approved" : order.status;
      }
    } else {
      order.status = "payment_failed";
      order.payment.gateway_status = "failed";
      order.payment.gateway_failed_code = resultCode || "unknown";
      order.payment.gateway_failed_message =
        payload.resultDesc || payload.resultMessage || payload.statusMessage || null;
    }
    order.hydration_token = encodeHydrationToken(order);
    await cacheOrder(order);
    if (order.status === "approved") {
      dispatchNotifications(order).catch((err) => console.warn("notify gagal:", err?.message || err));
    }
    return res.status(200).send("SUCCESS");
  } catch (err) {
    console.error("[duitku] callback error:", err);
    return res.status(500).send("ERROR");
  }
});

// admin: auth sederhana pakai header
router.use("/admin", (req, res, next) => {
  if (!ADMIN_SECRET) {
    return res.status(500).json({ ok: false, message: "ADMIN_SECRET belum diset" });
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  const token = String(req.headers["x-admin-key"] || "").trim();
  if (token !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
});

router.get("/admin/services/catalog", async (_req, res) => {
  try {
    const snapshot = await readCachedCatalog();
    return res.json(snapshot || { list: [], meta: null });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message || "catalog error" });
  }
});

router.post("/admin/services/catalog", async (req, res) => {
  try {
    const { services = [], source } = req.body || {};
    const snapshot = await saveManualCatalog(services, { source: source || "manual-upload" });
    return res.json({ ok: true, count: snapshot.list.length, meta: snapshot.meta });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message || "Invalid payload" });
  }
});

router.post("/admin/services/catalog/refresh", async (_req, res) => {
  try {
    const snapshot = await forceRefreshCatalog();
    return res.json({ ok: true, count: snapshot.list.length, meta: snapshot.meta });
  } catch (err) {
    return res.status(502).json({ ok: false, message: err.message, attempts: err.attempts || null });
  }
});

// admin: list order
router.get("/admin/orders", async (_, res) => {
  const orders = await loadAllOrders();
  return res.json(orders);
});

// admin: update status (mendukung POST & PATCH agar fleksibel)
async function handleAdminStatusUpdate(req, res) {
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
  order.hydration_token = encodeHydrationToken(order);
  await cacheOrder(order);
  dispatchNotifications(order).catch((err) => console.warn("notify gagal:", err?.message || err));

  return res.json({ ok: true, order });
}

router.post("/admin/orders/:orderId/status", handleAdminStatusUpdate);
router.patch("/admin/orders/:orderId/status", handleAdminStatusUpdate);

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
