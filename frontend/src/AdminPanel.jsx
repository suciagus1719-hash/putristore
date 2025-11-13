import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "https://putristore-backend.vercel.app";

export default function AdminPanel() {
  const [passwordInput, setPasswordInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const headers = adminKey ? { "x-admin-key": adminKey } : {};
  const statusChips = {
    pending_payment: "bg-yellow-500/20 text-yellow-100 border border-yellow-500/40",
    waiting_review: "bg-indigo-500/20 text-indigo-100 border border-indigo-500/40",
    approved: "bg-green-500/20 text-green-100 border border-green-500/40",
    rejected: "bg-red-500/20 text-red-100 border border-red-500/40",
    cancelled: "bg-slate-500/20 text-slate-100 border border-slate-500/40",
  };
  const formatStatus = (value) => String(value || "unknown").replace(/_/g, " ");
  const formatIDR = (value) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
      Number(value) || 0
    );
  const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) : "-";

  const fetchOrders = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error");
      setOrders(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async (order_id, status) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${order_id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error");
      fetchOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (authed) fetchOrders();
  }, [authed]);

  const handleLogin = async () => {
    if (!passwordInput.trim()) {
      setError("Password wajib diisi");
      return;
    }
    setError("");
    try {
      const attemptHeaders = { "x-admin-key": passwordInput.trim() };
      const res = await fetch(`${API_BASE}/api/admin/orders`, { headers: attemptHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Password salah");
      setOrders(data);
      setAdminKey(passwordInput.trim());
      setAuthed(true);
    } catch (err) {
      setError(err.message || "Password salah");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="bg-white/10 p-6 rounded-2xl space-y-4">
          <h1 className="text-xl font-semibold">Admin Login</h1>
          {error && <p className="text-red-400">{error}</p>}
          <input
            className="p-3 rounded-lg bg-black/40"
            type="password"
            placeholder="Admin Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button
            className="w-full bg-blue-500 p-3 rounded-lg"
            onClick={handleLogin}
          >
            Masuk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Panel Admin</h1>
        <button className="bg-slate-800 px-4 py-2 rounded" onClick={fetchOrders}>
          Refresh
        </button>
      </div>
      {error && <div className="bg-red-500/40 p-3 rounded">{error}</div>}

      <div className="space-y-4">
        {orders.map((order) => {
          if (!order) return null;
          const payment = order.payment || {};
          const chip = statusChips[order.status] || "bg-white/10 text-white border border-white/20";
          const proofUrl =
            typeof payment.proof_url === "string"
              ? payment.proof_url.startsWith("http")
                ? payment.proof_url
                : `${API_BASE}${payment.proof_url}`
              : null;
          return (
            <div key={order.order_id} className="bg-white/10 rounded-2xl p-5 space-y-4 border border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-white/50">Order #{order.order_id}</p>
                  <p className="text-lg font-semibold">{order.service_name || order.service_id}</p>
                  <p className="text-xs text-white/50">
                    {(order.platform || "-") + " • " + (order.category || "-")}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${chip}`}>
                  {formatStatus(order.status)}
                </span>
              </div>
              <div className="grid lg:grid-cols-3 gap-4 text-sm text-white/80">
                <div className="space-y-1">
                  <p className="text-white/50">Target</p>
                  <p className="font-medium break-words">{order.target || "-"}</p>
                  <p className="text-white/50 mt-3">Jumlah</p>
                  <p>{order.quantity?.toLocaleString("id-ID")}</p>
                  <p className="text-white/50 mt-3">Customer</p>
                  <p>{order.customer?.name || "-"}</p>
                  <p>{order.customer?.phone || "-"}</p>
                  <p>{order.customer?.email || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/50">Pembayaran</p>
                  <p>Metode: {payment.method || "-"}</p>
                  <p>Nominal: {formatIDR(payment.amount)}</p>
                  <p>Bukti: {formatStatus(payment.proof_status)}</p>
                  {payment.fallback_email && (
                    <p>Kirim bukti ke: <span className="text-white">{payment.fallback_email}</span></p>
                  )}
                  {proofUrl && (
                    <a className="text-blue-300 underline" href={proofUrl} target="_blank" rel="noreferrer">
                      Lihat bukti
                    </a>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-white/50">Timeline</p>
                  <p>Created: {formatDateTime(order.created_at)}</p>
                  <p>Dilaporkan: {formatDateTime(payment.reported_at)}</p>
                  <p>Deadline review: {formatDateTime(order.review_deadline)}</p>
                  {order.admin_note && (
                    <p className="mt-2">
                      Catatan Admin: <span className="text-white">{order.admin_note}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="flex-1 bg-green-600 p-2 rounded-lg disabled:opacity-40"
                  onClick={() => updateStatus(order.order_id, "approved")}
                  disabled={order.status === "approved"}
                >
                  Teruskan ke Panel
                </button>
                <button
                  className="flex-1 bg-red-600 p-2 rounded-lg disabled:opacity-40"
                  onClick={() => updateStatus(order.order_id, "rejected")}
                  disabled={order.status === "rejected" || order.status === "cancelled"}
                >
                  Tolak / Refund
                </button>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <p>Tidak ada order.</p>}
      </div>
    </div>
  );
}
