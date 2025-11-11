// backend/api/order/paymentFlow.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// penyimpanan bukti (sementara ke folder uploads/bukti)
const uploadDir = path.join(process.cwd(), "uploads/bukti");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

// order store sederhana (ganti ke DB kalau perlu)
const orders = new Map();
// helper bikin ID
const createOrderId = () => `ORD-${Date.now().toString(36).toUpperCase()}`;

// checkout – hanya simpan, status pending_payment
router.post("/order/checkout", (req, res) => {
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
  orders.set(order_id, order);
  return res.json({ ok: true, order });
});

// pilih metode bayar + nominal
router.post("/order/payment-method", (req, res) => {
  const { order_id, method, amount } = req.body || {};
  const order = orders.get(order_id);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  order.payment.method = method;
  order.payment.amount = Number(amount);
  order.status = "waiting_payment_proof";
  return res.json({ ok: true, order });
});

// upload bukti transfer
router.post("/order/upload-proof", upload.single("proof"), (req, res) => {
  const { order_id } = req.body || {};
  const order = orders.get(order_id);
  if (!order) return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
  if (!req.file) return res.status(400).json({ ok: false, message: "Bukti wajib diupload" });

  const fileUrl = `/uploads/bukti/${req.file.filename}`;
  order.payment.proof_url = fileUrl;
  order.payment.uploaded_at = new Date().toISOString();
  order.status = "waiting_review";
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
router.get("/admin/orders", (_, res) => {
  return res.json(Array.from(orders.values()));
});

// admin: update status
router.post("/admin/orders/:orderId/status", (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, message: "Tidak ada" });
  order.status = req.body.status || order.status;
  order.admin_note = req.body.admin_note || null;
  return res.json({ ok: true, order });
});

module.exports = router;
