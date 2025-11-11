// backend/api/order/upload-proof.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const { getOrder, saveOrder } = require("./orderStore");

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const uploadDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "putristore-bukti");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Use POST" });
  }

  upload.single("proof")(req, res, (err) => {
    if (err) {
      console.error("upload-proof error:", err);
      return res.status(400).json({ ok: false, message: err.message || "Upload gagal" });
    }

    const { order_id } = req.body || {};
    if (!order_id) {
      return res.status(422).json({ ok: false, message: "order_id wajib disertakan" });
    }

    const order = getOrder(order_id);
    if (!order) {
      return res.status(404).json({ ok: false, message: "Order tidak ditemukan" });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "File bukti wajib diupload" });
    }

    order.payment = order.payment || {};
    order.payment.proof_filename = req.file.filename;
    order.payment.proof_url = `/uploads/bukti/${req.file.filename}`;
    order.payment.uploaded_at = new Date().toISOString();
    order.status = "waiting_review";
    order.updated_at = new Date().toISOString();

    saveOrder(order);

    return res.status(200).json({ ok: true, order });
  });
};
