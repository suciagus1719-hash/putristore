import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "https://putristore-backend.vercel.app";

export default function AdminPanel() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const headers = authed ? { "x-admin-key": password } : {};

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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="w-full bg-blue-500 p-3 rounded-lg"
            onClick={() => setAuthed(true)}
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
        {orders.map((order) => (
          <div key={order.order_id} className="bg-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between">
              <p>Order: {order.order_id}</p>
              <span className="uppercase text-sm">{order.status}</span>
            </div>
            <p>Layanan: {order.service_id}</p>
            <p>Quantity: {order.quantity}</p>
            <p>Target: {order.target}</p>
            <p>Nominal: Rp {order.payment?.amount?.toLocaleString("id-ID")}</p>
            {order.payment?.proof_url && (
              <a className="text-blue-300 underline" href={order.payment.proof_url} target="_blank" rel="noreferrer">
                Lihat Bukti
              </a>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 bg-green-600 p-2 rounded-lg"
                onClick={() => updateStatus(order.order_id, "approved")}
              >
                Approve
              </button>
              <button
                className="flex-1 bg-red-600 p-2 rounded-lg"
                onClick={() => updateStatus(order.order_id, "rejected")}
              >
                Tolak
              </button>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p>Tidak ada order.</p>}
      </div>
    </div>
  );
}
