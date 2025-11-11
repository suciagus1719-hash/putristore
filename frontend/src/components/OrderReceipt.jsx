// frontend/src/components/OrderReceipt.jsx
import React, { useState } from 'react';

export default function OrderReceipt({ apiBase }) {
  const [order, setOrder] = useState(null);
  const [waLink, setWaLink] = useState('');
  const [customMessage, setCustomMessage] = useState(
    'Silakan lakukan pembayaran sesuai instruksi. Klik "Lanjutkan ke WhatsApp" agar order dikonfirmasi admin.'
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const form = new FormData(e.currentTarget);
      const payload = {
        service_id: form.get('service_id'),
        quantity: Number(form.get('quantity')),
        link: form.get('link'),
        customer: {
          name: form.get('name'),
          phone: form.get('phone'), // bisa kosong; hanya untuk catatan
          email: form.get('email'),
        },
      };

      const r = await fetch(`${apiBase}/api/order/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || `HTTP ${r.status}`);

      setOrder(j.order);
      setWaLink(j.wa_link);
      if (j.receipt_message_default) setCustomMessage(j.receipt_message_default);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!order) {
    // FORM INPUT ORDER
    return (
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <h3>Form Order</h3>

        <label>
          Service ID
          <input name="service_id" required placeholder="mis. 1234" />
        </label>

        <label>
          Quantity
          <input name="quantity" type="number" min="1" required defaultValue={100} />
        </label>

        <label>
          Link/Data
          <input name="link" required placeholder="https://..." />
        </label>

        <fieldset style={{ border: '1px solid #eee', padding: 12 }}>
          <legend>Data Pemesan (opsional)</legend>
          <label>
            Nama
            <input name="name" placeholder="Nama Anda" />
          </label>
          <label>
            No. HP (WhatsApp)
            <input name="phone" placeholder="628xxxxx" />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="email@contoh.com" />
          </label>
        </fieldset>

        {err && <div style={{ color: 'red' }}>{err}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Memproses…' : 'Lanjutkan Pembayaran'}
        </button>
      </form>
    );
  }

  // STRUK ORDER
  return (
    <div style={{ maxWidth: 640 }}>
      <h3>Struk Order</h3>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <p><strong>Order ID:</strong> {order.order_id}</p>
        <p><strong>Status:</strong> {order.status}</p>
        <p><strong>Service:</strong> {order.service_id}</p>
        <p><strong>Quantity:</strong> {order.quantity}</p>
        <p><strong>Data/Link:</strong> {order.link}</p>
        {order.customer?.name && <p><strong>Nama:</strong> {order.customer.name}</p>}
        {order.customer?.phone && <p><strong>HP:</strong> {order.customer.phone}</p>}
        {order.customer?.email && <p><strong>Email:</strong> {order.customer.email}</p>}
      </div>

      {/* Pesan bisa kamu ubah di state customMessage */}
      <textarea
        value={customMessage}
        onChange={(e) => setCustomMessage(e.target.value)}
        rows={4}
        style={{ width: '100%', marginBottom: 12 }}
      />

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => (window.location.href = waLink)}>
          Lanjutkan ke WhatsApp
        </button>
        <button onClick={() => window.location.reload()}>Buat Order Baru</button>
      </div>

      <p style={{ color: '#666', marginTop: 12 }}>
        Catatan: WhatsApp akan terbuka dengan pesan yang sudah terisi. Pengguna perlu menekan tombol kirim di WhatsApp.
      </p>
    </div>
  );
}
