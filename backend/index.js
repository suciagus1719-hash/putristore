// backend/index.js  (Express server di Vercel)
// CommonJS style (tidak perlu "type": "module")
const express = require("express");

// Node 18+ punya fetch global, kalau Node kamu <18 hilangkan komentar 2 baris di bawah:
// const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(express.json());
// CORS untuk mengizinkan request dari domain mana pun (Github Pages, dll.)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ====== ENV dari Vercel ======
const API_URL =
  process.env.SMMPANEL_BASE_URL ||
  process.env.PANEL_API_URL ||
  "https://pusatpanelsmm.com/api/json.php";

const API_KEY = process.env.SMMPANEL_API_KEY;
const SECRET  = process.env.SMMPANEL_SECRET;

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

// Jalankan server (Vercel tetap men-detect secara otomatis)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`putristore-backend listening on :${PORT}`));
