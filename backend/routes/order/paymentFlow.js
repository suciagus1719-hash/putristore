const express = require("express");
const multer = require("multer");
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";
const path = require("path");
const fs = require("fs");
const fetch = global.fetch || require("node-fetch");
const { saveOrder, getOrder, listOrders } = require("./orderStore");

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Key"
  );
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// penyimpanan bukti (sementara ke folder uploads/bukti)
const uploadDir = path.join(process.cwd(), "uploads/bukti");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

// expose folder bukti agar bisa dilihat admin (gunakan CDN/storage permanen untuk produksi)
router.use("/uploads/bukti", express.static(uploadDir));

async function cacheOrder(order) {
  if (!order?.order_id) return;
  await saveOrder(order);
}

async function loadOrder(orderId) {
  if (!orderId) return null;
  return getOrder(orderId);
}

// helper bikin ID
const createOrderId = () => `ORD-${Date.now().toString(36).toUpperCase()}`;
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
  const { service_id, quantity, target, customer = {} } = req.body || {};
  if (!service_id || !target || !Number.isFinite(Number(quantity)) || quantity <= 0) {
    return res.status(422).json({ ok: false, message: "Data tidak lengkap" });
  }
  const order_id = createOrderId();
  const order = {
    order_id,
    service_id,
    quantity: Number(quantity),
    target,
    customer,
    status: "pending_payment",
    payment: {
      method: null,
      amount: null,
      proof_url: null,
      uploaded_at: null,
      expires_at: Date.now() + 30 * 60 * 1000, // 30 menit
    },
    created_at: new Date().toISOString(),
  };
  await cacheOrder(order);
  return res.json({ ok: true, order });
});

// pilih metode bayar + nominal
router.post("/order/payment-method", async (req, res) => {
  const { order_id, method, amount } = req.body || {};
  const order = await loadOrder(order_id);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  order.payment.method = method;
  order.payment.amount = Number(amount);
  order.status = "waiting_payment_proof";
  await cacheOrder(order);
  return res.json({ ok: true, order });
});

// upload bukti transfer
router.post("/order/upload-proof", upload.single("proof"), async (req, res) => {
  const { order_id } = req.body || {};
  const order = await loadOrder(order_id);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  if (!req.file) return res.status(400).json({ ok: false, message: "Bukti wajib diupload" });

  const fileUrl = `/uploads/bukti/${req.file.filename}`;
  order.payment.proof_url = fileUrl;
  order.payment.uploaded_at = new Date().toISOString();
  order.status = "waiting_review";
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
  return res.json(await listOrders());
});

// admin: update status
router.post("/admin/orders/:orderId/status", async (req, res) => {
  const order = await loadOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, message: "Tidak ada" });
  const nextStatus = req.body.status || order.status;
  order.admin_note = req.body.admin_note || null;

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
  await cacheOrder(order);

  return res.json({ ok: true, order });
});

router.get("/order/status", async (req, res) => {
  try {
    const order_id = String(req.query.order_id || "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });
    if (!PANEL_KEY || !PANEL_SECRET) {
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SECRET belum diset" });
    }

    const basePayload = {
      api_key: PANEL_KEY,
      secret_key: PANEL_SECRET,
      action: "status",
      id: order_id,
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
        JSON.stringify({ ...basePayload, id: Number(order_id) })
      ));
    }

    if (!json || json.status !== true) {
      return res.status(502).json({
        message: json?.data?.msg || json?.error || "Gagal mengambil status",
        raw: json || raw,
      });
    }

    const data = json.data || {};
    const panelStatus = {
      order_id,
      status: data.status ?? "unknown",
      start_count: toNum(data.start_count),
      remains: toNum(data.remains ?? data.remain),
      charge: toNum(data.charge ?? data.price ?? data.harga),
    };

    const local = (await loadOrder(order_id)) || null;

    res.json({
      ...panelStatus,
      target: local?.target ?? null,
      service_name: local?.service_name ?? null,
      quantity: local?.quantity ?? null,
      provider_order_id: local?.provider_order_id ?? null,
      created_at: local?.created_at ?? null,
      payment: local?.payment ?? null,
    });
  } catch (err) {
    console.error("status error:", err);
    res.status(500).json({ message: String(err?.message || err) });
  }
});

module.exports = router;
