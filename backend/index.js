// backend/index.js  (Express server di Vercel)
// CommonJS style (tidak perlu "type": "module")
const express = require("express");
const applyCors = require("./routes/order/cors");
const paymentFlow = require("./routes/order/paymentFlow");

// Node 18+ punya fetch global, kalau Node kamu <18 hilangkan komentar 2 baris di bawah:
// const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(express.json());
// CORS untuk mengizinkan request dari domain mana pun (Github Pages, dll.)
app.use((req, res, next) => {
  if (applyCors(req, res)) return;
  next();
});
app.use("/api", paymentFlow);
const { kv } = require("@vercel/kv");

// simpan metadata order
async function saveOrderMeta(meta) {
  if (!meta?.order_id) return;
  // simpan sebagai JSON; TTL opsional (mis. 90 hari)
  await kv.set(`order:${meta.order_id}`, JSON.stringify(meta), { ex: 60 * 60 * 24 * 90 });
}

// ambil metadata order
async function getOrderMeta(orderId) {
  const raw = await kv.get(`order:${orderId}`);
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return raw || null; }
}
// POST /api/order/create
// body: { service_id, link, quantity, service_name, charge }
app.post("/api/order/create", async (req, res) => {
  try {
    const { service_id, link, quantity, service_name, charge } = req.body || {};
    if (!service_id || !link || !quantity) {
      return res.status(400).json({ message: "service_id, link, quantity diperlukan" });
    }

    // kirim ke panel (contoh generik; sesuaikan action sesuai dokumentasi panel)
    const payload = {
      api_key: API_KEY,
      secret_key: SECRET,
      action: "add",       // atau "order" sesuai panel
      service: Number(service_id),
      link,
      quantity: Number(quantity),
    };

    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();

    if (!r.ok || j?.status !== true || !j?.data?.id) {
      return res.status(502).json({ message: j?.data?.msg || j?.error || "Gagal membuat order", raw: j });
    }

    const order_id = String(j.data.id);

    // SIMPAN METADATA untuk dipakai saat cek status
    await saveOrderMeta({
      order_id,
      target: link,
      service_name: service_name || null,
      quantity: Number(quantity),
      charge: charge != null ? Number(charge) : null,
      created_at: new Date().toISOString(),
    });

    res.json({ order_id, ok: true });
  } catch (e) {
    res.status(500).json({ message: String(e?.message || e) });
  }
});

// ====== ENV dari Vercel ======
const API_URL =
  process.env.SMMPANEL_BASE_URL ||
  process.env.PANEL_API_URL ||
  "https://pusatpanelsmm.com/api/json.php";

const API_KEY = process.env.SMMPANEL_API_KEY;
const SECRET  = process.env.SMMPANEL_SECRET;
const IPAYMU_VA = process.env.IPAYMU_VA;
const IPAYMU_API = process.env.IPAYMU_API;

// Root
app.get("/", (req, res) => {
  res.send("putristore-backend OK");
});

// Helper normalisasi
function normalize(panelJson, order_id) {
  const d = (panelJson && panelJson.data) || {};
  return {
    order_id: String(order_id),
    status: d.status ?? "unknown",
    start_count: d.start_count ?? null,
    remains: d.remains ?? null,
    charge: d.charge ?? null,
    raw: panelJson,
  };
}

// ============ DIAGNOSA: lihat request/response ke panel ============
app.get("/api/status_probe", async (req, res) => {
  try {
    const order_id = String(req.query.order_id || "").trim();
    const diag = {
      order_id,
      env: {
        has_API_KEY: !!API_KEY,
        has_SECRET: !!SECRET,
        api_url: API_URL,
      },
      tries: [],
    };

    if (!order_id) {
      return res.status(400).json({ ok: false, message: "order_id diperlukan", diag });
    }
    if (!API_KEY || !SECRET) {
      return res.status(500).json({ ok: false, message: "ENV belum diset", diag });
    }

    // TRY 1: form-urlencoded
    const form = new URLSearchParams({
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: order_id,
    });

    let r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });
    let text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }

    diag.tries.push({
      mode: "POST_FORM",
      sent: Object.fromEntries(form),
      status: r.status,
      ok: r.ok,
      panel_raw_text: text,
      panel_parsed: parsed,
    });

    const looksIdMissing = String(text).toLowerCase().includes("id required");

    // TRY 2: JSON
    if (!r.ok || looksIdMissing) {
      const jsonBody = {
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: Number(order_id),
      };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(jsonBody),
      });
      text = await r.text();
      try { parsed = JSON.parse(text); } catch { parsed = null; }

      diag.tries.push({
        mode: "POST_JSON",
        sent: jsonBody,
        status: r.status,
        ok: r.ok,
        panel_raw_text: text,
        panel_parsed: parsed,
      });
    }

    return res.status(200).json({ ok: true, diag });
  } catch (e) {
    res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
});

// ============ PRODUKSI: status order ============
app.get("/api/order/status", async (req, res) => {
  try {
    const order_id = String(req.query.order_id || "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });
    if (!API_KEY || !SECRET)
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });

    // 1) coba form-urlencoded
    const form = new URLSearchParams({
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: order_id,
    });

    let r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });
    let text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = null; }

    const looksIdMissing = String(text).toLowerCase().includes("id required");

    // 2) fallback JSON bila perlu
    if (!r.ok || !j || j.status !== true || looksIdMissing) {
      const payload = {
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: Number(order_id),
      };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      text = await r.text();
      try { j = JSON.parse(text); } catch { j = null; }
    }

    if (!j || j.status !== true) {
      return res.status(502).json({
        message: (j && j.data && j.data.msg) || (j && j.error) || "Gagal mengambil status dari panel",
        raw: j || text,
      });
    }

    return res.json(normalize(j, order_id));
  } catch (e) {
    res.status(500).json({ message: String(e?.message || e) });
  }
});
// ============ PRODUKSI: status order ============
app.get("/api/order/status", async (req, res) => {
  try {
    const order_id = String(req.query.order_id || "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });
    if (!API_KEY || !SECRET)
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });

    // 1) coba form-urlencoded
    const form = new URLSearchParams({
      api_key: API_KEY,
      secret_key: SECRET,
      action: "status",
      id: order_id,
    });

    let r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form,
    });
    let text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = null; }

    const looksIdMissing = String(text).toLowerCase().includes("id required");

    // 2) fallback JSON bila perlu
    if (!r.ok || !j || j.status !== true || looksIdMissing) {
      const payload = {
        api_key: API_KEY,
        secret_key: SECRET,
        action: "status",
        id: Number(order_id),
      };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      text = await r.text();
      try { j = JSON.parse(text); } catch { j = null; }
    }

    if (!j || j.status !== true) {
      return res.status(502).json({
        message: (j && j.data && j.data.msg) || (j && j.error) || "Gagal mengambil status dari panel",
        raw: j || text,
      });
    }

    // ==== NORMALISASI: ambil semua kemungkinan nama field dari panel ====
    const d = j.data || {};
    const norm = {
      order_id,
      status: d.status ?? "unknown",
      start_count: toNum(d.start_count),
      remains: toNum(d.remains ?? d.remain),
      charge: toNum(d.charge ?? d.price ?? d.harga),

      // tambahan:
      target: d.target ?? d.link ?? d.username ?? d.profile ?? d.url ?? null,
      service_name: d.service_name ?? d.service ?? d.layanan ?? null,
      quantity: toNum(d.quantity ?? d.qty ?? d.jumlah),
      provider_order: d.provider_order ?? d.provider_order_id ?? null,

      // tanggal/waktu:
      created_at: d.created ?? d.created_at ?? d.date ?? d.datetime ?? null,
    };

    return res.json(norm);
  } catch (e) {
    res.status(500).json({ message: String(e?.message || e) });
  }
});

// helper sederhana
function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Jalankan server (Vercel tetap men-detect secara otomatis)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`putristore-backend listening on :${PORT}`));
