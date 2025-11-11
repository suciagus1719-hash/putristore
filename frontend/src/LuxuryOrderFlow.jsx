// frontend/src/LuxuryOrderFlow.jsx
import React, { useState, useEffect } from "react";


// Pakai apiBase dari config.js jika tersedia.
// Jika tidak ada config.js, fallback ke URL backend langsung.
let CONFIG_API_BASE = undefined;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  CONFIG_API_BASE = require("./config").apiBase;
} catch (_) {
  /* ignore */
}
const API_BASE_FALLBACK = "https://putristore-backend.vercel.app";
const apiBase = CONFIG_API_BASE || API_BASE_FALLBACK;

export default function LuxuryOrderFlow() {
  // --- FORM STATES ---
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [target, setTarget] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [services, setServices] = useState([]);

  // --- UI/REQ STATES ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- RECEIPT STATES ---
  const [receipt, setReceipt] = useState(null); // { order, wa_link }
  const [receiptMessage, setReceiptMessage] = useState(
    'Silakan lakukan pembayaran sesuai instruksi. Klik "Lanjutkan ke WhatsApp" agar order dikonfirmasi admin.'
  );
  useEffect(() => {
    fetch(`${apiBase}/api/services`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServices(data);
      })
      .catch((err) => console.error("Gagal ambil services:", err));
  }, []);
    if (services.length === 0) {
    console.log("Menunggu daftar layanan dari panel...");
  }


  async function handleCheckout(e) {
    e?.preventDefault?.();
    setError("");
    setLoading(true);

    try {
      const payload = {
        service_id: serviceId?.trim(),
        quantity: Number(quantity),
        target: target, // bebas: username / link / catatan
        customer: {
          name: customerName?.trim() || undefined,
          phone: customerPhone?.trim() || undefined,
          email: customerEmail?.trim() || undefined,
        },
      };

      // Perbaikan ringan: jika user mengetik target tanpa http/https tapi kamu ingin biarkan apa adanya,
      // JANGAN diubah. Biarkan backend menerima "target" bebas.

      // Debug lokal (bisa kamu nonaktifkan nanti)
      // console.log("checkout payload →", payload);

      const r = await fetch(`${apiBase}/api/order/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        j = { ok: false, message: text };
      }

      // console.log("checkout response →", r.status, j);

      if (!r.ok || !j.ok) {
        throw new Error(j?.message || `Gagal (${r.status})`);
      }

      // Sukses → tampilkan struk
      setReceipt({ order: j.order, wa_link: j.wa_link });
      if (j.receipt_message_default) {
        setReceiptMessage(j.receipt_message_default);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  // ====== RENDER STRUK ======
  if (receipt) {
    const o = receipt.order || {};
    return (
      <div className="min-h-[100svh] bg-gradient-to-b from-zinc-950 to-black text-zinc-50">
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold mb-2">Struk Order</h2>

            <div className="grid sm:grid-cols-2 gap-2 text-sm text-zinc-200">
              <div>
                <span className="text-zinc-400">Order ID:</span> {o.order_id}
              </div>
              <div>
                <span className="text-zinc-400">Status:</span>{" "}
                {o.status || "MENUNGGU PEMBAYARAN"}
              </div>
              <div>
                <span className="text-zinc-400">Service:</span> {o.service_id}
              </div>
              <div>
                <span className="text-zinc-400">Quantity:</span> {o.quantity}
              </div>
              <div className="sm:col-span-2 break-words">
                <span className="text-zinc-400">Target:</span>{" "}
                {o.target ?? o.link}
              </div>
              {o.customer?.name && (
                <div className="sm:col-span-2">
                  <span className="text-zinc-400">Nama:</span>{" "}
                  {o.customer.name}
                </div>
              )}
              {o.customer?.phone && (
                <div className="sm:col-span-2">
                  <span className="text-zinc-400">HP:</span>{" "}
                  {o.customer.phone}
                </div>
              )}
              {o.customer?.email && (
                <div className="sm:col-span-2">
                  <span className="text-zinc-400">Email:</span>{" "}
                  {o.customer.email}
                </div>
              )}
            </div>

            <label className="block mt-4 text-sm text-zinc-300">
              Pesan Tambahan (bebas diubah):
              <textarea
                className="w-full mt-2 p-3 rounded-xl border border-white/10 bg-white/10"
                rows={3}
                value={receiptMessage}
                onChange={(e) => setReceiptMessage(e.target.value)}
              />
            </label>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => (window.location.href = receipt.wa_link)}
                className="px-4 py-3 rounded-xl text-white bg-[#25D366]"
              >
                Lanjutkan ke WhatsApp
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="px-4 py-3 rounded-xl border border-white/10"
              >
                Ubah Data
              </button>
            </div>

            <p className="text-xs text-zinc-400 mt-3">
              WhatsApp akan terbuka dengan pesan yang sudah terisi. Pengguna
              perlu menekan tombol “Send”.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ====== RENDER FORM ======
  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-zinc-950 to-black text-zinc-50">
      <main className="max-w-xl mx-auto px-4 py-10">
        <form
          onSubmit={handleCheckout}
          className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-6"
        >
          <h2 className="text-2xl font-bold mb-2">Form Order</h2>

         <label className="text-sm">
  Pilih Layanan
  <select
    className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
    name="service_id"
    value={serviceId}
    onChange={(e) => setServiceId(e.target.value)}
    required
  >
    <option value="">-- Pilih Layanan --</option>
    {services.map((srv) => (
      <option key={srv.provider_service_id} value={srv.provider_service_id}>
        {srv.name} ({srv.category})
      </option>
    ))}
  </select>
</label>



          <label className="text-sm">
            Quantity
            <input
              className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
              name="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>

          <label className="text-sm">
            Target (bebas)
            <input
              className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
              name="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              placeholder="username / link / catatan"
            />
          </label>

          <fieldset className="mt-2 border border-white/10 rounded-xl p-3">
            <legend className="px-2 text-sm text-zinc-300">
              Data Pemesan (opsional)
            </legend>

            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <label className="text-sm">
                Nama
                <input
                  className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
                  name="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Anda"
                />
              </label>

              <label className="text-sm">
                No. HP (WhatsApp)
                <input
                  className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
                  name="phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="628xxxxx"
                />
              </label>

              <label className="text-sm sm:col-span-2">
                Email
                <input
                  className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
                  name="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@contoh.com"
                />
              </label>
            </div>
          </fieldset>

          {error && (
            <div className="text-red-400 text-sm mt-1">
              Error: {String(error)}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 px-4 py-3 rounded-xl text-white bg-blue-600 disabled:opacity-60"
          >
            {loading ? "Memproses…" : "Lanjutkan Pembayaran"}
          </button>

          <p className="text-xs text-zinc-400 mt-1">
            Server: <code className="opacity-80">{apiBase}</code>
          </p>
        </form>
      </main>
    </div>
  );
}
