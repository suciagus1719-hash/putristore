import React, { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "https://putristore-backend.vercel.app";
const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/link-grup-kamu";
const PAYMENT_PROOF_EMAIL =
  (import.meta.env?.VITE_PAYMENT_EMAIL && import.meta.env.VITE_PAYMENT_EMAIL.trim()) ||
  "putristore.invoice@gmail.com";
const PAYMENT_OPTIONS = [
  { value: "qris", label: "QRIS" },
  { value: "dana", label: "Dana" },
  { value: "gopay", label: "GoPay" },
  { value: "bri", label: "Transfer BRI" },
];

export default function PaymentFlow() {
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState(null);
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [target, setTarget] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [payment, setPayment] = useState({ method: "qris", amount: "" });
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const request = async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "Error");
    return data;
  };

  const handleCheckout = async () => {
    setError("");
    setLoading(true);
    try {
      const body = {
        service_id: serviceId,
        quantity: Number(quantity),
        target,
        customer,
        payment_email: PAYMENT_PROOF_EMAIL,
      };
      const data = await request("/api/order/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    setLoading(true);
    try {
      const data = await request("/api/order/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          method: payment.method,
          amount: Number(payment.amount),
          order_snapshot: order,
          proof_channel: proof ? "upload" : "email",
          fallback_email: PAYMENT_PROOF_EMAIL,
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
    setLoading(true);
    try {
      const form = new FormData();
      form.append("order_id", order.order_id);
      form.append("proof", proof);
      if (order) {
        form.append("order_snapshot", JSON.stringify(order));
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-700 to-black text-white">
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Alur Order Premium</h1>
        {error && <div className="bg-red-500/40 rounded-md p-3">{error}</div>}

        {step === 1 && (
          <section className="bg-white/10 p-4 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold">1. Form Order</h2>
            <input className="w-full p-3 rounded-lg bg-black/40"
              placeholder="Service ID"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            />
            <input className="w-full p-3 rounded-lg bg-black/40"
              type="number"
              min="1"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <input className="w-full p-3 rounded-lg bg-black/40"
              placeholder="Target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <div className="grid md:grid-cols-3 gap-3">
              <input className="p-3 rounded-lg bg-black/40"
                placeholder="Nama"
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
              />
              <input className="p-3 rounded-lg bg-black/40"
                placeholder="HP"
                value={customer.phone}
                onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
              />
              <input className="p-3 rounded-lg bg-black/40"
                placeholder="Email"
                value={customer.email}
                onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
            <button
              disabled={loading}
              onClick={handleCheckout}
              className="w-full bg-blue-500 p-3 rounded-xl"
            >
              {loading ? "Memproses..." : "Lanjutkan Pembayaran"}
            </button>
          </section>
        )}

        {step === 2 && order && (
          <section className="bg-white/10 p-4 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold">2. Pilih Metode Pembayaran</h2>
            <select
              className="w-full p-3 rounded-lg bg-black/40"
              value={payment.method}
              onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}
            >
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              className="w-full p-3 rounded-lg bg-black/40"
              type="number"
              placeholder="Nominal"
              value={payment.amount}
              onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
            />
            <div className="bg-black/40 rounded-lg p-3 text-sm space-y-1">
              Order ID: {order.order_id} <br />
              Batas bayar: {order.payment.expires_at ? new Date(order.payment.expires_at).toLocaleString() : "-"}
              <p className="text-white/60 text-xs">
                Setelah tombol di bawah ditekan, order akan menunggu persetujuan admin maksimal 1x24 jam.
              </p>
            </div>
            <button
              disabled={loading}
              onClick={handlePaymentMethod}
              className="w-full bg-green-500 p-3 rounded-xl"
            >
              {loading ? "Menyimpan..." : "Saya Sudah Transfer"}
            </button>
          </section>
        )}

        {step === 3 && order && (
          <section className="bg-white/10 p-4 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold">3. Upload Bukti Pembayaran</h2>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProof(e.target.files[0])}
              className="w-full"
            />
            <button
              disabled={loading || !proof}
              onClick={handleUploadProof}
              className="w-full bg-green-600 p-3 rounded-xl"
            >
              {loading ? "Mengunggah..." : "Upload & Lanjutkan"}
            </button>
            <button
              disabled={loading}
              onClick={() => setStep(4)}
              className="w-full bg-white/10 p-3 rounded-xl text-sm"
            >
              Lewati dulu, saya kirim via email ({PAYMENT_PROOF_EMAIL})
            </button>
          </section>
        )}

        {step === 4 && order && (
          <section className="bg-white/10 p-4 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold">4. Struk (Menunggu Konfirmasi)</h2>
            <div className="bg-black/40 rounded-lg p-3 space-y-1 text-sm">
              <p>Order: {order.order_id}</p>
              <p>Status: {order.status}</p>
              <p>Layanan: {order.service_id}</p>
              <p>Quantity: {order.quantity}</p>
              <p>Target: {order.target}</p>
              <p>Nominal: Rp {order.payment?.amount?.toLocaleString("id-ID")}</p>
              <p>Bukti: {order.payment?.proof_status || "menunggu"}</p>
              <p>Batas review: {order.review_deadline ? new Date(order.review_deadline).toLocaleString() : "-"}</p>
            </div>
            <button
              onClick={() => window.open(WHATSAPP_GROUP_LINK, "_blank")}
              className="w-full bg-green-500 p-3 rounded-xl"
            >
              Gabung ke Grup WhatsApp
            </button>
            <p className="text-xs text-white/60">
              Struk ini bisa digunakan untuk klaim garansi atau lapor kendala melalui grup WhatsApp resmi kami.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
