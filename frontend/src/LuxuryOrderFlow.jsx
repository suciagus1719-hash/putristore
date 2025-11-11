import React, { useState, useEffect } from "react";

const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/link-grup-kamu";

export default function LuxuryOrderFlow({ apiBase = "https://putristore-backend.vercel.app" }) {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [target, setTarget] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [step, setStep] = useState(1);
  const [payment, setPayment] = useState({ method: "qris", amount: "" });
  const [proof, setProof] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${apiBase}/api/services`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServices(data);
      })
      .catch(() => {
        /* ignore */
      });
  }, [apiBase]);

  const request = async (path, opts = {}) => {
    const res = await fetch(`${apiBase}${path}`, opts);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || "Server error");
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || `Error (${res.status})`);
    }
    return data;
  };

  const handleCheckout = async (e) => {
    e?.preventDefault();
    setError("");
    if (!serviceId || !target.trim()) {
      setError("Pilih layanan dan isi target terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        service_id: serviceId,
        quantity: Number(quantity),
        target: target.trim(),
        customer,
      };
      const data = await request("/api/order/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setOrder(data.order);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethod = async () => {
    setError("");
    if (!payment.amount) {
      setError("Masukkan nominal pembayaran.");
      return;
    }
    setLoading(true);
    try {
      const data = await request("/api/order/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          method: payment.method,
          amount: Number(payment.amount),
        }),
      });
      setOrder(data.order);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProof = async () => {
    setError("");
    if (!proof) {
      setError("Upload bukti pembayaran terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("order_id", order.order_id);
      form.append("proof", proof);
      const data = await request("/api/order/upload-proof", {
        method: "POST",
        body: form,
      });
      setOrder(data.order);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepTitle = (n, title) => (
    <h2 className="text-xl font-semibold mb-3">
      <span className="text-white/70">{n}.</span> {title}
    </h2>
  );

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-[#1c0e38] via-[#3a1980] to-[#12061f] text-white">
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <header className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Premium Flow</p>
          <h1 className="text-3xl sm:text-4xl font-bold">Luxury Order Flow</h1>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <form
            onSubmit={handleCheckout}
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4"
          >
            {renderStepTitle("1", "Form Order")}
            <label className="text-sm text-white/80 space-y-1 block">
              Pilih Layanan
              <select
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">-- Pilih Layanan --</option>
                {services.map((srv) => (
                  <option key={srv.provider_service_id} value={srv.provider_service_id}>
                    {srv.name} ({srv.category})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-white/80 space-y-1 block">
              Quantity
              <input
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            <label className="text-sm text-white/80 space-y-1 block">
              Target
              <input
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="username / link / catatan"
              />
            </label>

            <fieldset className="rounded-2xl border border-white/10 p-4 space-y-3">
              <legend className="px-2 text-sm text-white/60">Data Pemesan (opsional)</legend>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                  placeholder="Nama"
                  value={customer.name}
                  onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                />
                <input
                  className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                  placeholder="No. HP"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                />
                <input
                  className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                  placeholder="Email"
                  value={customer.email}
                  onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                />
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 font-semibold"
            >
              {loading ? "Memproses…" : "Lanjutkan Pembayaran"}
            </button>
            <p className="text-xs text-white/40 text-center">Server: {apiBase}</p>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4">
            {renderStepTitle("2", "Pilih Metode Pembayaran")}
            <div className="text-sm text-white/70 space-y-1">
              <p>Order ID: {order.order_id}</p>
              <p>Jumlah pesanan: {order.quantity}</p>
              <p>Batas bayar: {new Date(order.payment?.expires_at).toLocaleString()}</p>
            </div>

            <label className="text-sm text-white/80 space-y-1 block">
              Metode Bayar
              <select
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                value={payment.method}
                onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}
              >
                <option value="qris">QRIS</option>
                <option value="transfer">Transfer Bank</option>
              </select>
            </label>

            <label className="text-sm text-white/80 space-y-1 block">
              Nominal (Rp)
              <input
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                type="number"
                min="0"
                value={payment.amount}
                onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>

            <button
              onClick={handlePaymentMethod}
              disabled={loading}
              className="w-full rounded-2xl bg-green-500/80 py-3 font-semibold"
            >
              {loading ? "Menyimpan…" : "Saya Sudah Membayar"}
            </button>
          </section>
        )}

        {/* STEP 3 */}
        {step === 3 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4">
            {renderStepTitle("3", "Upload Bukti Pembayaran")}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProof(e.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-sm text-white/70"
            />
            <button
              onClick={handleUploadProof}
              disabled={loading || !proof}
              className="w-full rounded-2xl bg-indigo-500 py-3 font-semibold disabled:opacity-50"
            >
              {loading ? "Mengunggah…" : "Upload & Lanjutkan"}
            </button>
          </section>
        )}

        {/* STEP 4 */}
        {step === 4 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4">
            {renderStepTitle("4", "Struk Menunggu Konfirmasi")}
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-white/80">
              <div>
                <p className="text-white/50">Order ID</p>
                <p className="font-semibold">{order.order_id}</p>
              </div>
              <div>
                <p className="text-white/50">Status</p>
                <p className="font-semibold">{order.status}</p>
              </div>
              <div>
                <p className="text-white/50">Service</p>
                <p>{order.service_id}</p>
              </div>
              <div>
                <p className="text-white/50">Quantity</p>
                <p>{order.quantity}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-white/50">Target</p>
                <p>{order.target}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-white/50">Nominal</p>
                <p>Rp {payment.amount ? Number(payment.amount).toLocaleString("id-ID") : "-"}</p>
              </div>
            </div>

            <textarea
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm"
              rows={3}
              value="Silakan tunggu admin melakukan verifikasi pembayaran. Jika butuh bantuan cepat, gabung ke grup WhatsApp berikut."
              readOnly
            />

            <button
              onClick={() => window.open(WHATSAPP_GROUP_LINK, "_blank")}
              className="w-full rounded-2xl bg-[#25D366] py-3 font-semibold"
            >
              Gabung ke Grup WhatsApp
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
