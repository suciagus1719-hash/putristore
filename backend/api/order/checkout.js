// backend/api/order/checkout.js
const applyCors = require("./cors");
const { saveOrder } = require("./orderStore");

function safeJson(body) {
  if (typeof body === 'object' && body !== null) return body;
  try { return JSON.parse(body || '{}'); } catch { return {}; }
}

function genOrderId() {
  return 'ORD-' + Date.now().toString(36).toUpperCase();
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST' });

  try {
    const body = safeJson(req.body);

    // --- terima 'target' bebas; tetap kompatibel jika client lama masih kirim 'link'
    let { service_id, quantity, target, link, customer = {} } = body;
    if (!target && link) target = link;

    // === VALIDASI RINGAN (tanpa memaksa URL) ===
    if (!service_id) {
      return res.status(422).json({ ok: false, message: 'service_id wajib diisi' });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(422).json({ ok: false, message: 'quantity harus angka > 0' });
    }
    if (!target || String(target).trim().length < 1) {
      return res.status(422).json({ ok: false, message: 'target wajib diisi (bebas)' });
    }

    const order_id = genOrderId();
    const order = {
      order_id,
      service_id,
      quantity: qty,
      target,
      customer,
      status: 'pending_payment',
      payment: {
        method: null,
        amount: null,
        proof_url: null,
        uploaded_at: null,
      },
      created_at: new Date().toISOString(),
    };

    await saveOrder(order);

    // kembalikan untuk render struk
    return res.status(200).json({
      ok: true,
      order,
      receipt_message_default:
        'Silakan lakukan pembayaran sesuai instruksi. Setelah itu tekan "Saya sudah membayar" agar order diproses admin.',
    });
  } catch (e) {
    console.error('checkout error', e);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
};
