import React, { useEffect, useState } from "react";
import { buildApiUrl } from "../config.js";

const API = (path, opts = {}) => fetch(buildApiUrl(path), opts).then((r) => r.json());

export default function AdminPanel(){
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState([]);
  const [markup, setMarkup] = useState(0);
  const [tab, setTab] = useState('orders');

  async function login(){
    const r = await API('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password })});
    if (r.token) { localStorage.setItem('adminToken', r.token); setToken(r.token); }
    else alert(r.error || 'Gagal login admin');
  }

  async function load(){
    if(!token) return;
    const h = { headers: { 'x-admin-token': token }};
    const cfg = await API('/api/admin/config', h);
    if (cfg?.PRICE_MARKUP_PERCENT != null) setMarkup(cfg.PRICE_MARKUP_PERCENT);
    const o = await API('/api/admin/orders', h);
    setOrders(o || []);
  }

  async function saveCfg(){
    const h = { method:'POST', headers: { 'Content-Type':'application/json', 'x-admin-token': token }, body: JSON.stringify({ PRICE_MARKUP_PERCENT: Number(markup) }) };
    const r = await API('/api/admin/config', h);
    if (r.status) alert('Markup disimpan'); else alert('Gagal simpan');
  }

  useEffect(()=>{ load() }, [token]);

  if (!token) {
    return (
      <section className="max-w-md mx-auto p-6">
        <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
        <input type="password" className="w-full border rounded-xl px-3 py-2 mb-3" placeholder="Admin Password"
          value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={login} className="w-full rounded-xl bg-purple-700 text-white py-2">Masuk</button>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin Panel</h2>
        <button onClick={()=>{localStorage.removeItem('adminToken'); setToken('')}} className="text-sm underline">Logout</button>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={()=>setTab('orders')} className={`px-3 py-1 rounded ${tab==='orders'?'bg-purple-700 text-white':'bg-gray-200'}`}>Orders</button>
        <button onClick={()=>setTab('config')} className={`px-3 py-1 rounded ${tab==='config'?'bg-purple-700 text-white':'bg-gray-200'}`}>Config</button>
      </div>

      {tab==='config' && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow">
          <div className="mb-3">Markup Harga (%):</div>
          <input type="number" className="border rounded-xl px-3 py-2" value={markup} onChange={e=>setMarkup(e.target.value)} />
          <button onClick={saveCfg} className="ml-3 px-4 py-2 rounded-xl bg-purple-700 text-white">Simpan</button>
        </div>
      )}

      {tab==='orders' && (
        <div className="mt-4 grid gap-3">
          {orders.map(o=>(
            <div key={o.order_id} className="rounded-2xl bg-white p-4 shadow">
              <div className="font-semibold">{o.service_name}</div>
              <div className="text-xs text-slate-500">{o.platform} · {o.action}</div>
              <div className="mt-1 text-sm break-all">{o.link}</div>
              <div className="mt-1 text-sm">Qty: {o.quantity} · Harga: Rp {o.price}</div>
              <div className="mt-1 text-sm">Status: <b>{o.status}</b></div>
              <div className="mt-1 text-xs">Order ID: {o.order_id} · Provider: {o.provider_order_id || '-'}</div>
            </div>
          ))}
          {!orders.length && <div className="text-sm text-slate-500">Belum ada pesanan.</div>}
        </div>
      )}
    </section>
  );
}
