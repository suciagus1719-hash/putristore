import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Instagram,
  Music2,
  Youtube,
  Facebook,
  Send,
  ShoppingBag,
  Users,
  Heart,
  Eye,
  MessageCircle,
  Share2,
  Menu,
  X,
  ShieldCheck,
  CreditCard,
  Wallet,
  Smartphone,
  Images,
  Download,
  Clock,
} from "lucide-react";

const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/link-grup-kamu";
const API_FALLBACK = "https://putristore-backend.vercel.app";
const AVATAR_URL = "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=60";
const QRIS_IMAGE_URL = "https://i.imgur.com/lQjQpMZ.png"; // ganti dengan QRIS asli

const PLATFORM_CARDS = [
  { key: "Instagram", label: "Instagram", accent: "from-pink-500 to-amber-400", icon: Instagram },
  { key: "TikTok", label: "TikTok", accent: "from-gray-700 to-black", icon: Music2 },
  { key: "YouTube", label: "YouTube", accent: "from-red-600 to-orange-600", icon: Youtube },
  { key: "Facebook", label: "Facebook", accent: "from-sky-600 to-blue-700", icon: Facebook },
  { key: "Telegram", label: "Telegram", accent: "from-cyan-400 to-blue-500", icon: Send },
  { key: "Shopee", label: "Shopee", accent: "from-orange-500 to-amber-500", icon: ShoppingBag },
];

const getPlatformIcon = (platform) =>
  PLATFORM_CARDS.find((p) => p.key === platform)?.icon || ShieldCheck;

const CATEGORY_ICONS = {
  Followers: Users,
  Likes: Heart,
  Views: Eye,
  Comments: MessageCircle,
  Shares: Share2,
  Subscribers: Users,
  Members: Users,
  Reactions: Heart,
  Other: ShieldCheck,
};

const FALLBACK_CATEGORIES = [
  "Followers",
  "Likes",
  "Views",
  "Comments",
  "Shares",
  "Subscribers",
  "Members",
  "Reactions",
  "Other",
];

const PAYMENT_METHODS = [
  { key: "qris", label: "QRIS", icon: CreditCard },
  { key: "dana", label: "Dana", icon: Wallet },
  { key: "ovo", label: "OVO", icon: Smartphone },
  { key: "bri", label: "Transfer BRI", icon: CreditCard },
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

const formatWitaTime = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date || new Date());

const formatWitaDate = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date || new Date());

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
  const [payment, setPayment] = useState({ method: "qris", amount: 0 });
  const [proof, setProof] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderTimestamp, setOrderTimestamp] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);

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
          const sanitized = data.filter(Boolean);
          const allFallback =
            sanitized.length && sanitized.every((cat) => FALLBACK_CATEGORIES.includes(cat));
          if (!allFallback) {
            setCategories(sanitized);
            setSelectedCategory("");
          } else {
            setCategories([]);
            setSelectedCategory("");
          }
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
    return allServices.filter((srv) => {
      const plat = guessPlatform(srv.name || srv.category || "");
      if (plat !== selectedPlatform) return false;
      if (!selectedCategory) return false;
      return (
        srv.category &&
        srv.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase()
      );
    });
  }, [allServices, selectedPlatform, selectedCategory]);

  const pricePreview = useMemo(() => {
    if (!selectedService) return 0;
    const rate = Number(selectedService.rate_per_1k) || 0;
    const qty = Number(quantity) || 0;
    return Math.max((rate / 1000) * qty, 0);
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
      setOrderTimestamp(new Date());
      setPayment((prev) => ({ ...prev, amount: pricePreview || prev.amount }));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethod = async () => {
    setError("");
    if (!proof) {
      setError("Upload bukti pembayaran terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      await request("/api/order/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          method: payment.method,
          amount: payment.amount || pricePreview,
        }),
      });

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
    setPayment((prev) => ({ ...prev, amount: (Number(srv.rate_per_1k) / 1000) * (quantity || min) }));
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

  const generateReceiptImage = () => {
    if (!order) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#1f0a3d");
    gradient.addColorStop(1, "#4b1da1");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(60, 60, 1080, 510);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px 'Poppins', sans-serif";
    ctx.fillText("Struk Order Premium", 120, 140);

    ctx.font = "24px 'Poppins', sans-serif";
    const details = [
      [`Order ID`, order.order_id],
      ["Layanan", `${selectedService?.name || order.service_id} (${order.service_id})`],
      ["Target", order.target],
      ["Quantity", order.quantity],
      ["Nama", customer.name || "-"],
      ["No. WhatsApp", customer.phone || "-"],
      ["Email", customer.email || "-"],
      ["Nominal", formatIDR(payment.amount || pricePreview)],
      ["Tanggal", formatWitaDate(orderTimestamp)],
      ["Jam (WITA)", formatWitaTime(orderTimestamp)],
    ];

    let y = 200;
    details.forEach(([label, value]) => {
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`${label}:`, 120, y);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(value), 360, y);
      y += 40;
    });

    ctx.fillStyle = "#a78bfa";
    ctx.font = "20px 'Poppins', sans-serif";
    ctx.fillText("Terima kasih telah memesan layanan kami.", 120, 520);

    setReceiptImage(canvas.toDataURL("image/png"));
  };

  useEffect(() => {
    if (step === 4 && order) {
      generateReceiptImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, order]);

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
    setPayment({ method: "qris", amount: 0 });
    setProof(null);
    setTarget("");
    setQuantity(100);
    setOrderTimestamp(null);
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
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent" />
        </div>
      )}

      <button
        className="fixed top-4 left-4 z-30 rounded-2xl bg-white/10 border border-white/20 p-2 backdrop-blur"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
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
          <button onClick={( ) => setMenuOpen(false)} aria-label="Close menu">
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

      <main className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Premium Flow</p>
            <h1 className="text-4xl font-extrabold">Luxury Order Experience</h1>
            <p className="text-white/70 max-w-2xl">
              Pilih platform favoritmu, tentukan jenis layanan, dan nikmati proses pembayaran modern
              lengkap dengan monitoring admin.
            </p>
          </div>
          <img
            src={AVATAR_URL}
            alt="Avatar"
            className="w-16 h-16 rounded-full border-2 border-white/50 object-cover shadow-lg"
          />
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
              <p className="text-sm text-white/60">Memuat kategori�</p>
            ) : (
              selectedPlatform && (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS.Other;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm border flex items-center gap-2 ${
                          selectedCategory === cat
                            ? "bg-white text-purple-800 border-white"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )
            )}

            <div className="space-y-3">
              <p className="text-sm uppercase tracking-wide text-white/50">
                Pilih layanan ({servicesLoading ? "memuat�" : `${filteredServices.length} opsi`})
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
                      <p className="text-xs text-white/50">ID: {srv.provider_service_id}</p>
                      <p className="font-semibold text-lg">{srv.name}</p>
                      <p className="text-xs text-white/60 mb-2">{srv.category}</p>
                      <div className="text-sm text-white/80">
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

                <div className="text-sm border border-white/10 rounded-2xl p-4 bg-black/20 space-y-3">
                  <p className="font-semibold text-white">Informasi Layanan</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-white/80">
                    <p>Harga per 1.000 qty: {formatIDR(selectedService.rate_per_1k)}</p>
                    <p>Min Order: {selectedService.min}</p>
                    <p>Max Order: {selectedService.max}</p>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed text-white/70">
                    {selectedService.description || "Deskripsi belum tersedia dari panel."}
                  </p>
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
                  placeholder="No. WhatsApp"
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
              disabled={!selectedService}
              onClick={handleCheckout}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 font-semibold disabled:opacity-50"
            >
              Lanjutkan Pembayaran
            </button>

            <p className="text-xs text-white/40 text-center">Server: {apiBase}</p>
          </section>
        )}

        {step === 2 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-6">
            {renderStepTitle("2", "Konfirmasi Pembayaran")}
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-white/80">
              <div>
                <p className="text-white/50">Order ID</p>
                <p className="font-semibold">{order.order_id}</p>
              </div>
              <div>
                <p className="text-white/50">ID Layanan</p>
                <p>{order.service_id}</p>
              </div>
              <div>
                <p className="text-white/50">Nama</p>
                <p>{customer.name || "-"}</p>
              </div>
              <div>
                <p className="text-white/50">Nomor WhatsApp</p>
                <p>{customer.phone || "-"}</p>
              </div>
              <div>
                <p className="text-white/50">Email</p>
                <p>{customer.email || "-"}</p>
              </div>
              <div>
                <p className="text-white/50">Jam Order (WITA)</p>
                <p>{formatWitaTime(orderTimestamp)}</p>
              </div>
              <div>
                <p className="text-white/50">Tanggal Order</p>
                <p>{formatWitaDate(orderTimestamp)}</p>
              </div>
              <div>
                <p className="text-white/50">Nominal</p>
                <p className="text-lg font-semibold">{formatIDR(payment.amount || pricePreview)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-white/70">Pilih Metode Pembayaran</p>
              <div className="grid sm:grid-cols-4 gap-3">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => setPayment((p) => ({ ...p, method: method.key }))}
                      className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 justify-center ${
                        payment.method === method.key
                          ? "border-white bg-white/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {payment.method === "qris" && (
                <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-center">
                  <p className="text-sm text-white/70 mb-2">Scan QRIS berikut:</p>
                  <img
                    src={QRIS_IMAGE_URL}
                    alt="QRIS"
                    className="mx-auto max-w-[280px] rounded-xl border border-white/10"
                  />
                </div>
              )}
              {payment.method === "dana" && (
                <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-white/70">
                  Kirim pembayaran ke akun Dana: <span className="text-white">08xx-xxxx-xxxx (Putri)</span>
                </div>
              )}
              {payment.method === "ovo" && (
                <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-white/70">
                  Kirim pembayaran ke akun OVO: <span className="text-white">08xx-xxxx-xxxx (Putri)</span>
                </div>
              )}
              {payment.method === "bri" && (
                <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-white/70">
                  Transfer ke rek. BRI <span className="text-white">1234-5678-90 a.n Putri Store</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/80 space-y-1 block">
                Upload Bukti Pembayaran
                <div className="rounded-2xl border border-dashed border-white/30 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
                  <Images className="w-6 h-6 mx-auto mb-2" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProof(e.target.files?.[0] || null)}
                    className="w-full text-center"
                  />
                </div>
              </label>
              <button
                onClick={handlePaymentMethod}
                disabled={!proof}
                className="w-full rounded-2xl bg-green-500 py-3 font-semibold disabled:opacity-50"
              >
                Saya sudah membayar
              </button>
            </div>
          </section>
        )}

        {step === 4 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4">
            {renderStepTitle("3", "Struk Menunggu Konfirmasi")}
            {receiptImage ? (
              <img
                src={receiptImage}
                alt="Struk Premium"
                className="w-full rounded-2xl border border-white/20"
              />
            ) : (
              <div className="text-sm text-white/70">Sedang membuat gambar struk�</div>
            )}
            {receiptImage && (
              <a
                href={receiptImage}
                download={`Struk-${order.order_id}.png`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/20 border border-white/30 text-sm"
              >
                <Download className="w-4 h-4" />
                Download Struk
              </a>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => window.open(WHATSAPP_GROUP_LINK, "_blank")}
                className="rounded-2xl bg-[#25D366] py-3 font-semibold"
              >
                Gabung ke Grup WhatsApp
              </button>
              <button
                onClick={handleStatusCheck}
                className="rounded-2xl border border-white/20 py-3 font-semibold text-white/80 flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Status Order
              </button>
            </div>
            <button
              onClick={resetFlow}
              className="w-full rounded-2xl bg-white/10 border border-white/20 py-3 text-sm text-white/80"
            >
              Buat order baru
            </button>
          </section>
        )}
      </main>
    </div>
  );
}









