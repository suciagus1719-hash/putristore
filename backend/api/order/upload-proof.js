// backend/api/order/upload-proof.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const applyCors = require("./cors");
const { getOrder, saveOrder } = require("./orderStore");

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
  if (applyCors(req, res)) return;
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

    getOrder(order_id)
      .then((order) => {
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

        return saveOrder(order).then(() => res.status(200).json({ ok: true, order }));
      })
      .catch((dbErr) => {
        console.error("upload-proof load/save error:", dbErr);
        return res.status(500).json({ ok: false, message: "Internal error" });
      });
  });
};
