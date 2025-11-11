import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Instagram,
  Music2,
  Youtube,
  Facebook,
  Send,
  ShoppingBag,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";

const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/link-grup-kamu";
const API_FALLBACK = "https://putristore-backend.vercel.app";

const PLATFORM_CARDS = [
  { key: "Instagram", label: "Instagram", accent: "from-pink-500 to-amber-400", icon: Instagram },
  { key: "TikTok", label: "TikTok", accent: "from-gray-700 to-black", icon: Music2 },
  { key: "YouTube", label: "YouTube", accent: "from-red-600 to-orange-600", icon: Youtube },
  { key: "Facebook", label: "Facebook", accent: "from-sky-600 to-blue-700", icon: Facebook },
  { key: "Telegram", label: "Telegram", accent: "from-cyan-400 to-blue-500", icon: Send },
  { key: "Shopee", label: "Shopee", accent: "from-orange-500 to-amber-500", icon: ShoppingBag },
];

const guessPlatform = (s = "") => {
  const n = String(s).toLowerCase();
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("youtube")) return "YouTube";
  if (n.includes("facebook")) return "Facebook";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("twitter") || n.includes(" x ")) return "Twitter/X";
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return "Shopee";
  return "Other";
};

const formatIDR = (value) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );

export default function LuxuryOrderFlow({ apiBase = API_FALLBACK }) {
  const navigate = useNavigate();
  const orderRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  const [allServices, setAllServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  const [selectedPlatform, setSelectedPlatform] = useState("Instagram");
  const [categories, setCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedService, setSelectedService] = useState(null);

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
    async function loadServices() {
      try {
        setServicesLoading(true);
        const res = await fetch(`${apiBase}/api/services`);
        const list = await res.json();
        if (Array.isArray(list)) setAllServices(list);
      } catch (e) {
        console.error("Gagal memuat services:", e);
      } finally {
        setServicesLoading(false);
      }
    }
    loadServices();
  }, [apiBase]);

  useEffect(() => {
    if (!selectedPlatform) return;
    async function loadCategories() {
      try {
        setCategoryLoading(true);
        const res = await fetch(
          `${apiBase}/api/actions?platform=${encodeURIComponent(selectedPlatform)}`
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          setCategories(data);
          setSelectedCategory(data[0]);
        } else {
          setCategories([]);
          setSelectedCategory("");
        }
      } catch (e) {
        console.error("Gagal memuat kategori:", e);
        setCategories([]);
        setSelectedCategory("");
      } finally {
        setCategoryLoading(false);
        setSelectedService(null);
        setServiceId("");
      }
    }
    loadCategories();
  }, [apiBase, selectedPlatform]);

  const filteredServices = useMemo(() => {
    return allServices
      .filter((srv) => guessPlatform(srv.name || srv.category) === selectedPlatform)
      .filter((srv) =>
        selectedCategory ? srv.category?.toLowerCase().includes(selectedCategory.toLowerCase()) : true
      )
      .slice(0, 50);
  }, [allServices, selectedPlatform, selectedCategory]);

  const pricePreview = useMemo(() => {
    if (!selectedService) return 0;
    const rate = Number(selectedService.rate_per_1k) || 0;
    const qty = Number(quantity) || 0;
    return (rate / 1000) * qty;
  }, [selectedService, quantity]);

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
    if (!selectedService || !target.trim()) {
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

  const handleSelectService = (srv) => {
    setSelectedService(srv);
    setServiceId(String(srv.provider_service_id));
    const min = Number(srv.min) || 1;
    if (!quantity || quantity < min) setQuantity(min);
  };

  const handleStatusCheck = async () => {
    const orderId = window.prompt("Masukkan Order ID Anda");
    if (!orderId) return;
    try {
      const res = await fetch(
        `${apiBase}/api/order/status?order_id=${encodeURIComponent(orderId.trim())}`
      );
      const data = await res.json();
      if (!res.ok || data.message) throw new Error(data.message || "Order ID tidak ditemukan");
      alert(
        `Status ${orderId}:\n- Status: ${data.status}\n- Remains: ${data.remains ?? "-"}\n- Start: ${
          data.start_count ?? "-"
        }`
      );
    } catch (err) {
      alert(`Gagal cek status: ${err.message}`);
    }
  };

  const menuItems = [
    {
      label: "Order",
      action: () => {
        setMenuOpen(false);
        orderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    },
    { label: "Admin", action: () => { setMenuOpen(false); navigate("/admin"); } },
    { label: "Status Order", action: () => { setMenuOpen(false); handleStatusCheck(); } },
    {
      label: "Monitoring Sosmed",
      action: () => {
        setMenuOpen(false);
        window.open("https://t.me/+monitoringsosmed", "_blank", "noopener");
      },
    },
  ];

  const resetFlow = () => {
    setStep(1);
    setOrder(null);
    setPayment({ method: "qris", amount: "" });
    setProof(null);
    setTarget("");
    setQuantity(100);
  };

  const renderStepTitle = (n, title) => (
    <h2 className="text-xl font-semibold mb-3">
      <span className="text-white/60">{n}.</span> {title}
    </h2>
  );

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart == null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    if (delta > 80) setMenuOpen(true);
    if (delta < -80) setMenuOpen(false);
    setTouchStart(null);
  };

  return (
    <div
      className="min-h-[100svh] bg-gradient-to-b from-[#1d0b2d] via-[#37106b] to-[#090213] text-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="fixed top-4 left-4 z-30 rounded-2xl bg-white/10 border border-white/20 p-2 backdrop-blur"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f021d]/95 border-r border-white/10 backdrop-blur-lg transform transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-semibold">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            PutriStore
          </div>
          <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <header className="mb-6 space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Premium Flow</p>
          <h1 className="text-4xl font-extrabold">Luxury Order Experience</h1>
          <p className="text-white/70 max-w-2xl">
            Pilih platform favoritmu, tentukan jenis layanan, dan nikmati proses pembayaran modern
            lengkap dengan monitoring admin.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {step === 1 && (
          <section
            ref={orderRef}
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-6"
          >
            {renderStepTitle("1", "Pilih Platform & Layanan")}
            <div className="grid sm:grid-cols-3 gap-3">
              {PLATFORM_CARDS.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setSelectedPlatform(card.key)}
                  className={`rounded-2xl border px-4 py-4 text-left transition shadow-sm flex items-center gap-3 bg-gradient-to-br ${card.accent} ${
                    selectedPlatform === card.key
                      ? "border-white shadow-lg"
                      : "border-white/10 opacity-80 hover:opacity-100"
                  }`}
                >
                  <card.icon className="w-6 h-6" />
                  <div>
                    <p className="font-semibold">{card.label}</p>
                    <p className="text-xs text-white/70">Tap untuk pilih</p>
                  </div>
                </button>
              ))}
            </div>

            {categoryLoading ? (
              <p className="text-sm text-white/60">Memuat kategori…</p>
            ) : (
              selectedPlatform && (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm border ${
                        selectedCategory === cat
                          ? "bg-white text-purple-800 border-white"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )
            )}

            <div className="space-y-3">
              <p className="text-sm uppercase tracking-wide text-white/50">
                Pilih layanan ({servicesLoading ? "memuat…" : `${filteredServices.length} opsi`})
              </p>
              <div className="grid md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-2">
                {filteredServices.length === 0 && (
                  <div className="col-span-2 text-white/60 text-sm">Tidak ada layanan.</div>
                )}
                {filteredServices.map((srv) => {
                  const selected = selectedService?.provider_service_id === srv.provider_service_id;
                  return (
                    <button
                      key={srv.provider_service_id}
                      type="button"
                      onClick={() => handleSelectService(srv)}
                      className={`text-left rounded-2xl border px-4 py-4 bg-white/5 hover:bg-white/10 transition ${
                        selected ? "border-white shadow-lg" : "border-white/10"
                      }`}
                    >
                      <p className="font-semibold">{srv.name}</p>
                      <p className="text-xs text-white/60">{srv.category}</p>
                      <div className="mt-2 text-sm text-white/80">
                        <p>Harga: {formatIDR((srv.rate_per_1k || 0) / 1000)} / qty</p>
                        <p>
                          Min/Max: {srv.min} - {srv.max}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedService && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm text-white/80 space-y-1 block">
                    Quantity
                    <input
                      className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
                      type="number"
                      min={selectedService.min || 1}
                      max={selectedService.max || undefined}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                    <span className="text-xs text-white/50">
                      Min {selectedService.min} • Max {selectedService.max}
                    </span>
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
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-white/50">Perkiraan Harga</p>
                    <p className="text-lg font-semibold">{formatIDR(pricePreview)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Per 1.000 qty</p>
                    <p>{formatIDR(selectedService.rate_per_1k)}</p>
                  </div>
                </div>
              </>
            )}

            <fieldset className="rounded-2xl border border-white/10 p-4 space-y-3">
              <legend className="px-2 text-sm text-white/60">Data Pemesan</legend>
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
              disabled={loading || !selectedService}
              onClick={handleCheckout}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 font-semibold disabled:opacity-50"
            >
              {loading ? "Memproses…" : "Lanjutkan Pembayaran"}
            </button>

            {selectedService?.description && (
              <div className="text-sm text-white/70 border border-white/10 rounded-2xl p-4 bg-black/20">
                <p className="font-semibold text-white">Deskripsi Layanan</p>
                <p>{selectedService.description}</p>
              </div>
            )}

            <p className="text-xs text-white/40 text-center">Server: {apiBase}</p>
          </section>
        )}

        {step === 2 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4">
            {renderStepTitle("2", "Konfirmasi Pembayaran")}
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
                <p>{formatIDR(payment.amount)}</p>
              </div>
            </div>
            <textarea
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm"
              rows={3}
              value="Silakan tunggu admin melakukan verifikasi pembayaran. Jika butuh bantuan cepat, gabung ke grup WhatsApp berikut."
              readOnly
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => window.open(WHATSAPP_GROUP_LINK, "_blank")}
                className="rounded-2xl bg-[#25D366] py-3 font-semibold"
              >
                Gabung ke Grup WhatsApp
              </button>
              <button
                onClick={resetFlow}
                className="rounded-2xl border border-white/20 py-3 font-semibold text-white/80"
              >
                Buat Order Baru
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
