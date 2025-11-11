// backend/api/order/checkout.js
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || '*';
const WA_NUMBER = process.env.WA_NUMBER || process.env.FRONTEND_WA_NUMBER || '6281234567890';


function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function safeJson(body) {
  if (typeof body === 'object' && body !== null) return body;
  try { return JSON.parse(body || '{}'); } catch { return {}; }
}

function genOrderId() {
  return 'ORD-' + Date.now().toString(36).toUpperCase();
}

// (opsional) simpan order ke storage/DB kamu
async function saveOrder(order) {
  // TODO: tulis ke SQLite / file / firestore sesuai selera
  return true;
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
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

    // Rangkai pesan WhatsApp untuk admin
    const lines = [
      `Pesanan Baru (Website)`,
      `=====================`,
      `Order ID : ${order_id}`,
      `Service  : ${service_id}`,
      `Quantity : ${qty}`,
      `Target   : ${target}`,
      customer?.name ? `Nama     : ${customer.name}` : null,
      customer?.phone ? `HP       : ${customer.phone}` : null,
      customer?.email ? `Email    : ${customer.email}` : null,
    ].filter(Boolean);

    const waMsg = lines.join('\n');
    const wa_link = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    // Simpan sebagai pending (opsional)
    await saveOrder({
      order_id,
      service_id,
      quantity: qty,
      target,
      customer,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    // kembalikan untuk render struk
    return res.status(200).json({
      ok: true,
      order: {
        order_id,
        service_id,
        quantity: qty,
        target,      // <- penting: kirim target ke FE
        customer,
        status: 'MENUNGGU PEMBAYARAN',
      },
      wa_link,
      receipt_message_default:
        'Silakan lakukan pembayaran sesuai instruksi. Setelah itu tekan "Lanjutkan ke WhatsApp" agar order diproses admin.',
    });
  } catch (e) {
    console.error('checkout error', e);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
};
