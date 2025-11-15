import React, { useCallback, useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "./config.js";
const STATUS_META = [
  { key: "all", label: "Semua" },
  { key: "pending_payment", label: "Pending Pembayaran" },
  { key: "waiting_review", label: "Menunggu Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

const statusChips = {
  pending_payment: "bg-amber-500/15 text-amber-200 border border-amber-500/40",
  waiting_review: "bg-indigo-500/15 text-indigo-200 border border-indigo-500/40",
  approved: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40",
  rejected: "bg-rose-500/15 text-rose-200 border border-rose-500/40",
  cancelled: "bg-slate-500/15 text-slate-200 border border-slate-500/40",
};

const formatStatus = (value) => String(value || "unknown").replace(/_/g, " ");
const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );
const formatDate = (value) =>
  value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) : "-";
const absoluteUrlPattern = /^https?:\/\//i;
const resolveProofUrl = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:") || absoluteUrlPattern.test(trimmed)) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return buildApiUrl(path);
};

export default function AdminPanel() {
  const [passwordInput, setPasswordInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("waiting_review");
  const [search, setSearch] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [toast, setToast] = useState("");
  const [expandedOrders, setExpandedOrders] = useState({});
  const [catalogMeta, setCatalogMeta] = useState(null);

  const authHeaders = useMemo(() => (adminKey ? { "x-admin-key": adminKey } : {}), [adminKey]);
  const catalogUpdatedLabel = catalogMeta?.cached_at ? formatDate(catalogMeta.cached_at) : "Belum pernah sinkron";

  const fetchOrders = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildApiUrl("/api/admin/orders"), { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal memuat order");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      if (err.message?.toLowerCase().includes("unauthorized")) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [adminKey, authHeaders]);

  const fetchCatalogMeta = useCallback(async () => {
    if (!adminKey) return;
    try {
      const res = await fetch(buildApiUrl("/api/admin/services/catalog"), { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal memuat katalog");
      setCatalogMeta(data?.meta || null);
    } catch (err) {
      console.warn("catalog meta error:", err.message);
    }
  }, [adminKey, authHeaders]);

  useEffect(() => {
    if (authed) {
      fetchOrders();
      fetchCatalogMeta();
    }
  }, [authed, fetchOrders, fetchCatalogMeta]);

  const handleLogin = async () => {
    if (!passwordInput.trim()) {
      setError("Password wajib diisi");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const secret = passwordInput.trim();
      const res = await fetch(buildApiUrl("/api/admin/orders"), { headers: { "x-admin-key": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Password salah");
      setOrders(Array.isArray(data) ? data : []);
      setAdminKey(secret);
      setAuthed(true);
      setPasswordInput("");
    } catch (err) {
      setError(err.message || "Password salah");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthed(false);
    setAdminKey("");
    setPasswordInput("");
    setOrders([]);
    setNoteDrafts({});
    setToast("");
  };

  const updateStatus = async ({ order_id, status, admin_note }) => {
    try {
      const res = await fetch(buildApiUrl(`/api/admin/orders/${order_id}/status`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ status, admin_note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal memperbarui order");
      showToast("Order diperbarui");
      fetchOrders();
    } catch (err) {
      showToast(err.message || "Gagal update", true);
    }
  };

  const syncServices = async () => {
    try {
      const res = await fetch(buildApiUrl("/api/admin/services/catalog/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal sinkron layanan");
      setCatalogMeta(data.meta || null);
      showToast(`Sinkron ${data.count || 0} layanan`);
    } catch (err) {
      showToast(err.message || "Gagal sinkron layanan", true);
    }
  };

  const showToast = (message, isError = false) => {
    setToast(message ? `${isError ? "[!]" : "[OK]"} ${message}` : "");
    if (message) {
      setTimeout(() => setToast(""), 2500);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        order.order_id?.toLowerCase().includes(q) ||
        order.customer?.name?.toLowerCase().includes(q) ||
        order.target?.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, search]);

  const summary = useMemo(() => {
    const total = orders.length;
    const waiting = orders.filter((o) => o.status === "waiting_review").length;
    const pending = orders.filter((o) => o.status === "pending_payment").length;
    const approved = orders.filter((o) => o.status === "approved").length;
    const todayIncome = orders
      .filter((o) => o.status === "approved" && o.timeline?.approved_at)
      .reduce((sum, o) => sum + Number(o.payment?.amount || 0), 0);
    return { total, waiting, pending, approved, todayIncome };
  }, [orders]);

  const handleNoteChange = (orderId, value) =>
    setNoteDrafts((prev) => ({ ...prev, [orderId]: value }));

  const handleNoteSave = (order) =>
    updateStatus({
      order_id: order.order_id,
      status: order.status,
      admin_note: noteDrafts[order.order_id] ?? order.admin_note ?? "",
    });

  const handleExport = (type) => {
    const dataset = filteredOrders.length ? filteredOrders : orders;
    if (!dataset.length) return showToast("Tidak ada data untuk diekspor", true);

    let blob;
    if (type === "csv") {
      const headersCsv = [
        "order_id",
        "status",
        "service_id",
        "service_name",
        "platform",
        "category",
        "quantity",
        "target",
        "customer_name",
        "customer_phone",
        "customer_email",
        "payment_method",
        "payment_amount",
        "created_at",
      ];
      const rows = dataset.map((o) =>
        [
          o.order_id,
          o.status,
          o.service_id,
          o.service_name,
          o.platform,
          o.category,
          o.quantity,
          o.target,
          o.customer?.name,
          o.customer?.phone,
          o.customer?.email,
          o.payment?.method,
          o.payment?.amount,
          o.created_at,
        ]
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [headersCsv.join(","), ...rows].join("\n");
      blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    } else {
      blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "csv" ? "putristore-orders.csv" : "putristore-orders.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data berhasil diunduh");
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      showToast("Disalin ke clipboard");
    } catch {
      showToast("Gagal menyalin", true);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0b041c] via-[#13072d] to-[#040212] flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">PutriStore</p>
          <h1 className="text-3xl font-bold mb-6">Admin Portal</h1>
          <p className="text-sm text-white/70 mb-4">Masukkan ADMIN_SECRET untuk mengakses dashboard.</p>
          {error && <div className="mb-3 rounded-xl bg-rose-500/15 border border-rose-400/30 px-4 py-2 text-sm text-rose-100">{error}</div>}
          <input
            className="w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            type="password"
            placeholder="Admin Secret"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button
            disabled={loading}
            onClick={handleLogin}
            className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 py-3 font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            {loading ? "Memverifikasi..." : "Masuk Dashboard"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050111] text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 to-transparent pointer-events-none" />
        <header className="max-w-6xl mx-auto px-6 pt-10 pb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.4em] uppercase text-white/50">PutriStore Admin</p>
            <h1 className="text-3xl font-bold">Control Center</h1>
            <p className="text-sm text-white/60">Kelola order, pembayaran, dan catatan pelanggan secara real-time.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchOrders}
              className="rounded-2xl px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/20 transition"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>
            <button
              onClick={() => handleExport("json")}
              className="rounded-2xl px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/20 transition"
            >
              Download JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="rounded-2xl px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/20 transition"
            >
              Download CSV
            </button>
            <button
              onClick={handleLogout}
              className="rounded-2xl px-4 py-2 bg-rose-500/20 border border-rose-400/40 hover:bg-rose-500/30 transition"
            >
              Keluar
            </button>
          </div>
        </header>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-10">
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Order" value={summary.total} accent="from-purple-500 to-indigo-500" />
          <SummaryCard title="Menunggu Review" value={summary.waiting} accent="from-blue-500 to-cyan-500" />
          <SummaryCard title="Pending Payment" value={summary.pending} accent="from-amber-500 to-orange-500" />
          <SummaryCard
            title="Approved Hari Ini"
            value={formatCurrency(summary.todayIncome)}
            accent="from-emerald-500 to-lime-500"
          />
        </section>

        <section className="bg-white/5 rounded-3xl border border-white/10 p-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-white/60 uppercase">Katalog Layanan</p>
              <p className="text-lg font-semibold text-white">{catalogUpdatedLabel}</p>
              <p className="text-xs text-white/50">Sumber: {catalogMeta?.source || "-"}</p>
            </div>
            <button
              onClick={syncServices}
              className="px-4 py-2 rounded-2xl bg-purple-700 text-white text-xs font-semibold"
            >
              Sinkronkan
            </button>
          </div>
          <p className="text-xs text-white/60">
            Tekan tombol ketika daftar layanan di halaman utama kosong.
          </p>
        </section>

        <section className="bg-white/5 rounded-3xl border border-white/10 p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_META.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setStatusFilter(item.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    statusFilter === item.key ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <input
              className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Cari order ID, nama, atau target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>

        {error && <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 px-4 py-3 text-sm text-rose-100">{error}</div>}

        <section className="space-y-4">
          {filteredOrders.length === 0 && (
            <div className="text-center py-16 rounded-3xl border border-white/5 bg-white/5 text-white/60">
              {loading ? "Memuat data..." : "Tidak ada order sesuai filter."}
            </div>
          )}

          {filteredOrders.map((order) => {
            const payment = order.payment || {};
            const proofUrl = resolveProofUrl(payment.proof_url);
            const noteValue = noteDrafts[order.order_id] ?? order.admin_note ?? "";
            const expanded = Boolean(expandedOrders[order.order_id]);

            return (
              <article
                key={order.order_id}
                className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-5 shadow-lg shadow-black/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-white/50">Order #{order.order_id}</p>
                    <p className="text-lg font-semibold flex items-center gap-2">
                      {order.service_name || order.service_id}
                      <button
                        className="text-xs bg-white/10 px-2 py-0.5 rounded-full"
                        onClick={() => copyText(order.order_id)}
                      >
                        Salin ID
                      </button>
                    </p>
                    <p className="text-xs text-white/50">
                      {(order.platform || "-") + " • " + (order.category || "-")}
                    </p>
                    <p className="text-xs text-white/40">Service ID: {order.service_id || "-"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                        statusChips[order.status] || "bg-white/10 border border-white/20"
                      }`}
                    >
                      {formatStatus(order.status)}
                    </span>
                    <button
                      className="text-xs px-3 py-1 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition"
                      onClick={() =>
                        setExpandedOrders((prev) => ({ ...prev, [order.order_id]: !prev[order.order_id] }))
                      }
                    >
                      {expanded ? "Sembunyikan" : "Lihat Detail"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="grid lg:grid-cols-4 gap-4 text-sm text-white/80">
                  <div className="space-y-2">
                    <p className="text-white/50 uppercase text-xs">Customer</p>
                    <p>{order.customer?.name || "-"}</p>
                    <p>{order.customer?.phone || "-"}</p>
                    <p>{order.customer?.email || "-"}</p>
                    <p className="text-white/50 uppercase text-xs mt-4">Target</p>
                    <p className="break-words">{order.target || "-"}</p>
                    <button
                      className="text-xs text-purple-300 underline"
                      onClick={() => copyText(order.target)}
                    >
                      Salin target
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-white/50 uppercase text-xs">Detail Order</p>
                    <p>Jumlah: {order.quantity?.toLocaleString("id-ID")}</p>
                    <p>Metode: {payment.method || "-"}</p>
                    <p>Nominal: {formatCurrency(payment.amount)}</p>
                    <p>Status bukti: {formatStatus(payment.proof_status)}</p>
                    {proofUrl && (
                      <a className="text-xs text-blue-300 underline" href={proofUrl} target="_blank" rel="noreferrer">
                        Lihat bukti
                      </a>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-white/50 uppercase text-xs">Timeline</p>
                    <p>Order: {formatDate(order.created_at)}</p>
                    <p>Dilaporkan: {formatDate(payment.reported_at)}</p>
                    <p>Deadline review: {formatDate(order.review_deadline)}</p>
                    <p>Approved: {formatDate(order.timeline?.approved_at)}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-white/50 uppercase text-xs">Catatan Admin</p>
                    <textarea
                      value={noteValue}
                      onChange={(e) => handleNoteChange(order.order_id, e.target.value)}
                      className="w-full rounded-2xl bg-black/30 border border-white/10 p-3 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => handleNoteSave(order)}
                      className="w-full rounded-2xl bg-white/10 border border-white/20 py-2 text-xs uppercase tracking-wide"
                    >
                      Simpan Catatan
                    </button>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        className="rounded-2xl bg-emerald-500/20 border border-emerald-400/40 py-2"
                        onClick={() => updateStatus({ order_id: order.order_id, status: "approved", admin_note: noteValue })}
                        disabled={order.status === "approved"}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-2xl bg-rose-500/20 border border-rose-400/40 py-2"
                        onClick={() => updateStatus({ order_id: order.order_id, status: "rejected", admin_note: noteValue })}
                      >
                        Tolak
                      </button>
                      <button
                        className="rounded-2xl bg-slate-500/20 border border-slate-400/40 py-2 col-span-2"
                        onClick={() => updateStatus({ order_id: order.order_id, status: "waiting_review", admin_note: noteValue })}
                      >
                        Tandai Waiting Review
                      </button>
                    </div>
                  </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-full bg-black/80 border border-white/10 backdrop-blur text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, accent }) {
  return (
    <div className={`rounded-3xl p-4 text-white bg-gradient-to-br ${accent} shadow-lg shadow-black/30`}>
      <p className="text-sm text-white/70">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
