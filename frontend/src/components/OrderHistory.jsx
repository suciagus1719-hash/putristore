import React, { useState } from "react";
import { buildApiUrl } from "../config.js";

export default function OrderHistory() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);

  async function search() {
    const res = await fetch(buildApiUrl(`/api/orders/lookup?q=${encodeURIComponent(q)}`));
    setItems(await res.json());
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-6">
      <h2 className="text-xl font-semibold mb-3">Riwayat Pesanan</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2"
          placeholder="Cari dengan Nama/WhatsApp atau link"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={search} className="px-4 py-2 rounded-xl bg-purple-700 text-white">
          Cari
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-3">
        {items.map((o) => (
          <div key={o.order_id} className="rounded-2xl border p-4 bg-white shadow">
            <div className="font-semibold">{o.service_name}</div>
            <div className="text-xs text-slate-500">
              {o.platform} | {o.action}
            </div>
            <div className="mt-1 text-sm break-all">{o.link}</div>
            <div className="mt-1 text-sm">
              Qty: {o.quantity} | Harga: Rp {o.price}
            </div>
            <div className="mt-1 text-sm">
              Status: <b>{o.status}</b>
            </div>
            <div className="mt-1 text-xs">
              Order ID: {o.order_id} | Provider: {o.provider_order_id || "-"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
