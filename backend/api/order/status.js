app.get("/api/order/status", async (req, res) => {
  try {
    const order_id = String(req.query.order_id || "").trim();
    if (!order_id) return res.status(400).json({ message: "order_id diperlukan" });
    if (!API_KEY || !SECRET)
      return res.status(500).json({ message: "ENV SMMPANEL_API_KEY / SMMPANEL_SECRET belum diset" });

    // 1) request ke panel (form-urlencoded dulu)
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

    // fallback JSON bila perlu
    const looksIdMissing = String(text).toLowerCase().includes("id required");
    if (!r.ok || !j || j.status !== true || looksIdMissing) {
      const payload = { api_key: API_KEY, secret_key: SECRET, action: "status", id: Number(order_id) };
      r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      text = await r.text();
      try { j = JSON.parse(text); } catch { j = null; }
    }
    if (!j || j.status !== true) {
      return res.status(502).json({ message: j?.data?.msg || j?.error || "Gagal mengambil status", raw: j || text });
    }

    // 2) normalisasi dari panel
    const d = j.data || {};
    const fromPanel = {
      order_id,
      status: d.status ?? "unknown",
      start_count: toNum(d.start_count),
      remains: toNum(d.remains ?? d.remain),
      charge: toNum(d.charge ?? d.price ?? d.harga),
    };

    // 3) AMBIL metadata lokal & MERGE → kalau panel tidak kirim, pakai nilai KV
    const meta = await getOrderMeta(order_id);
    const merged = {
      ...fromPanel,
      target: fromPanel.target ?? meta?.target ?? null,
      service_name: meta?.service_name ?? null,
      quantity: meta?.quantity ?? null,
      provider_order: meta?.provider_order ?? null,  // kalau suatu saat kamu isi
      created_at: meta?.created_at ?? null,
    };

    return res.json(merged);
  } catch (e) {
    res.status(500).json({ message: String(e?.message || e) });
  }
});

function toNum(v) { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
