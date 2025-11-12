import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  AtSign,
  Music,
  Film,
  MessageSquare,
  Gamepad2,
  Twitter,
  Twitch,
  Cloud,
  Linkedin,
  Play,
  BookOpen,
  Pin,
  Share,
  PlayCircle,
  Disc,
} from "lucide-react";

const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/link-grup-kamu";
const API_FALLBACK = "https://putristore-backend.vercel.app";
const AVATAR_URL =
  (import.meta?.env?.VITE_OWNER_AVATAR && import.meta.env.VITE_OWNER_AVATAR.trim()) ||
  "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=60";
const BRAND_BADGE_URL =
  (import.meta?.env?.VITE_BRAND_BADGE && import.meta.env.VITE_BRAND_BADGE.trim()) ||
  "https://i.ibb.co/pRFcpq0/putri-gmoyy.png";
const QRIS_IMAGE_URL = "https://i.imgur.com/lQjQpMZ.png"; // ganti dengan QRIS asli

const PLATFORM_CARDS = [
  { key: "Instagram", label: "Instagram", accent: "from-pink-500 to-amber-400", icon: Instagram },
  { key: "TikTok", label: "TikTok", accent: "from-gray-700 to-black", icon: Music2 },
  { key: "YouTube", label: "YouTube", accent: "from-red-600 to-orange-600", icon: Youtube },
  { key: "Facebook", label: "Facebook", accent: "from-sky-600 to-blue-700", icon: Facebook },
  { key: "Telegram", label: "Telegram", accent: "from-cyan-400 to-blue-500", icon: Send },
  { key: "Shopee", label: "Shopee", accent: "from-orange-500 to-amber-500", icon: ShoppingBag },
  { key: "Threads", label: "Threads", accent: "from-gray-900 to-black", icon: AtSign },
  { key: "WhatsApp", label: "WhatsApp", accent: "from-emerald-500 to-lime-500", icon: MessageCircle },
  { key: "Spotify", label: "Spotify", accent: "from-green-500 to-emerald-600", icon: Music },
  { key: "Discord", label: "Discord", accent: "from-indigo-500 to-purple-600", icon: Gamepad2 },
  { key: "Snack Video", label: "Snack Video", accent: "from-yellow-400 to-orange-500", icon: Film },
  { key: "Twitter", label: "Twitter / X", accent: "from-sky-400 to-blue-500", icon: Twitter },
  { key: "Twitch", label: "Twitch", accent: "from-purple-600 to-indigo-600", icon: Twitch },
  { key: "SoundCloud", label: "SoundCloud", accent: "from-orange-500 to-red-500", icon: Cloud },
  { key: "Reddit", label: "Reddit", accent: "from-orange-400 to-pink-500", icon: Share },
  { key: "Quora", label: "Quora", accent: "from-rose-500 to-red-600", icon: BookOpen },
  { key: "Pinterest", label: "Pinterest", accent: "from-red-500 to-rose-500", icon: Pin },
  { key: "Mobile App", label: "Mobile App Install", accent: "from-slate-700 to-slate-900", icon: Download },
  { key: "Kwai", label: "Kwai", accent: "from-amber-400 to-orange-500", icon: Film },
  { key: "LinkedIn", label: "LinkedIn", accent: "from-blue-500 to-blue-700", icon: Linkedin },
  { key: "Likee", label: "Likee", accent: "from-pink-500 via-orange-400 to-yellow-400", icon: Heart },
  { key: "Google Play", label: "Google Play Review", accent: "from-green-400 to-blue-500", icon: Play },
  { key: "Dailymotion", label: "Dailymotion", accent: "from-indigo-500 to-blue-700", icon: PlayCircle },
  { key: "Audiomack", label: "Audiomack", accent: "from-yellow-400 to-red-500", icon: Disc },
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
  "Discord",
];

const PAYMENT_METHODS = [
  { key: "qris", label: "QRIS", icon: CreditCard },
  { key: "dana", label: "Dana", icon: Wallet },
  { key: "ovo", label: "OVO", icon: Smartphone },
  { key: "bri", label: "Transfer BRI", icon: CreditCard },
];

const DEFAULT_QUANTITY = 100;
const createEmptyCustomer = () => ({ name: "", phone: "", email: "" });
const EXCLUDED_SERVICE_KEYWORDS = ["website traffic"];
const EXCLUDED_CATEGORY_KEYWORDS = ["website traffic", "traffic", "visitor", "visit"];
const EXCLUDED_PLATFORM_NAMES = ["Website Traffic", "Website Visitor", "Traffic"];
const INSTAGRAM_CATEGORY_ORDER = [
  "Instagram - Channel Members",
  "Instagram - Comments [ Custom ]",
  "Instagram - Comments [ Indonesia ]",
  "Instagram - Comments [ Random ]",
  "Instagram - Comments [ Likes ]",
  "Instagram - Followers [ Guaranteed ]",
  "Instagram - Likes [ Photo ]",
  "Instagram - Likes [ Video / IGTV / Reels ]",
  "Instagram - Live Stream S1",
  "Instagram - Live Stream S2",
  "Instagram - Live Stream S3",
  "Instagram - Saves",
  "Instagram - Shares",
  "Instagram - Story [ Quiz / Poll ]",
  "Instagram - Story [ Views ]",
  "Instagram - Views [ Video / IGTV / Reels ]",
  "Instagram - Views [ Indonesia ]",
];
const PROFIT_PERCENT = Number(import.meta.env?.VITE_PROFIT_RATE ?? 0.5);
const MARKUP_FACTOR = 1 + PROFIT_PERCENT;
const applyMarkup = (base) => Math.max(base * MARKUP_FACTOR, 0);

const shouldHideCategory = (value = "") => {
  const lower = String(value).toLowerCase();
  if (!lower) return false;
  if (EXCLUDED_CATEGORY_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (FALLBACK_CATEGORIES.some((fallback) => fallback.toLowerCase() === lower)) return true;
  return false;
};

const guessPlatform = (s = "") => {
  const n = String(s).toLowerCase();
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("threads")) return "Threads";
  if (n.includes("whatsapp") || n.includes(" wa ") || n.startsWith("wa ") || n.includes("wa.")) return "WhatsApp";
  if (n.includes("spotify")) return "Spotify";
  if (n.includes("discord")) return "Discord";
  if (n.includes("snack") && n.includes("video")) return "Snack Video";
  if (n.includes("youtube")) return "YouTube";
  if (n.includes("facebook")) return "Facebook";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("twitter") || n.includes(" x ")) return "Twitter";
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return "Shopee";
  if (n.includes("twitch")) return "Twitch";
  if (n.includes("soundcloud")) return "SoundCloud";
  if (n.includes("reddit")) return "Reddit";
  if (n.includes("quora")) return "Quora";
  if (n.includes("pinterest")) return "Pinterest";
  if (n.includes("mobile app") || n.includes("app install")) return "Mobile App";
  if (n.includes("kwai")) return "Kwai";
  if (n.includes("linkedin")) return "LinkedIn";
  if (n.includes("likee")) return "Likee";
  if (n.includes("google play") || n.includes("playstore") || n.includes("play store")) return "Google Play";
  if (n.includes("dailymotion")) return "Dailymotion";
  if (n.includes("audiomack")) return "Audiomack";
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

  const displayCategories = useMemo(() => {
    return categories
      .map((cat) => String(cat || "").trim())
      .filter((cat) => {
        if (!cat) return false;
        if (shouldHideCategory(cat)) return false;
        const lower = cat.toLowerCase();
        return !FALLBACK_CATEGORIES.some((fallback) => fallback.toLowerCase() === lower);
      });
  }, [categories]);

  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
  const [target, setTarget] = useState("");
  const [customer, setCustomer] = useState(createEmptyCustomer);
  const [step, setStep] = useState(1);
  const [payment, setPayment] = useState({ method: "qris", amount: 0 });
  const [proof, setProof] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderTimestamp, setOrderTimestamp] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);
  const [buttonGlowPhase, setButtonGlowPhase] = useState(0);

  const categoryCache = useRef({});
  const prevPlatformRef = useRef(selectedPlatform);
  const prevCategoryRef = useRef(selectedCategory);

  const resetOrderInputs = useCallback(() => {
    setSelectedService(null);
    setServiceId("");
    setQuantity(DEFAULT_QUANTITY);
    setTarget("");
    setCustomer(createEmptyCustomer());
    setPayment((prev) => ({ ...prev, amount: 0 }));
    setProof(null);
    setOrder(null);
    setStep(1);
    setError("");
  }, []);

  const deriveCategories = useCallback(
    (platform) => {
      if (!platform || !allServices.length) return [];
      const normalized = new Set();
      allServices.forEach((srv) => {
        const nameLower = String(srv.name || "").toLowerCase();
        if (EXCLUDED_SERVICE_KEYWORDS.some((kw) => nameLower.includes(kw))) return;
        const plat = guessPlatform(srv.name || srv.category || "");
        if (plat === platform && srv.category) {
          const cat = String(srv.category).trim();
          if (!shouldHideCategory(cat)) normalized.add(cat);
        }
      });
      let baseList = Array.from(normalized)
        .map((cat) => cat.trim())
        .filter((cat) => {
          if (!cat) return false;
          if (shouldHideCategory(cat)) return false;
          const lower = cat.toLowerCase();
          return !FALLBACK_CATEGORIES.some((fallback) => fallback.toLowerCase() === lower);
        });

      const alphabetical = [...baseList].sort((a, b) => a.localeCompare(b));
      if (platform === "Instagram") {
        const priorityAvailable = INSTAGRAM_CATEGORY_ORDER.filter((cat) => alphabetical.includes(cat));
        const remaining = alphabetical.filter((cat) => !priorityAvailable.includes(cat));
        return [...priorityAvailable, ...remaining];
      }
      return alphabetical;
    },
    [allServices]
  );

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
    const platformLabel = selectedPlatform.toLowerCase();
    if (EXCLUDED_PLATFORM_NAMES.some((kw) => platformLabel.includes(kw.toLowerCase()))) {
      setCategories([]);
      setSelectedCategory("");
      return;
    }
    const derivedList = deriveCategories(selectedPlatform);
    const applyCategories = (list = []) => {
      const merged = [...new Set([...(derivedList || []), ...list])];
      const filtered = merged
        .map((item) => String(item || "").trim())
        .filter((item) => item && !shouldHideCategory(item));
      const sorted =
        selectedPlatform === "Instagram"
          ? [
              ...INSTAGRAM_CATEGORY_ORDER.filter((cat) => filtered.includes(cat)),
              ...filtered
                .filter((cat) => !INSTAGRAM_CATEGORY_ORDER.includes(cat))
                .sort((a, b) => a.localeCompare(b)),
            ]
          : filtered.sort((a, b) => a.localeCompare(b));
      setCategories(sorted);
      setSelectedCategory((prev) => (sorted.includes(prev) ? prev : sorted[0] || ""));
    };

    const platformChanged = prevPlatformRef.current !== selectedPlatform;
    if (platformChanged) {
      prevCategoryRef.current = "";
      resetOrderInputs();
    }

    if (derivedList.length) {
      applyCategories(derivedList);
    } else if (!categoryCache.current[selectedPlatform]) {
      applyCategories([]);
    }

    if (categoryCache.current[selectedPlatform]?.length) {
      applyCategories(categoryCache.current[selectedPlatform]);
    }

    let ignore = false;
    const controller = new AbortController();
    setCategoryLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/actions?platform=${encodeURIComponent(selectedPlatform)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        const sanitized = Array.isArray(data)
          ? data.map((cat) => String(cat || "").trim()).filter(Boolean)
          : [];
        const refined = sanitized.filter((cat) => {
          if (shouldHideCategory(cat)) return false;
          const lower = cat.toLowerCase();
          return !FALLBACK_CATEGORIES.some((fallback) => fallback.toLowerCase() === lower);
        });
        if (!ignore) {
          const result = refined.length ? refined : sanitized;
          categoryCache.current[selectedPlatform] = result;
          applyCategories(result);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Gagal memuat kategori:", e);
        }
      } finally {
        if (!ignore) setCategoryLoading(false);
      }
    })();

    prevPlatformRef.current = selectedPlatform;
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [apiBase, selectedPlatform, deriveCategories, resetOrderInputs]);

  useEffect(() => {
    if (prevCategoryRef.current === selectedCategory) {
      return;
    }
    if (selectedCategory) {
      resetOrderInputs();
    }
    prevCategoryRef.current = selectedCategory;
  }, [selectedCategory, resetOrderInputs]);

  const filteredServices = useMemo(() => {
    return allServices.filter((srv) => {
      const nameLower = String(srv.name || "").toLowerCase();
      if (EXCLUDED_SERVICE_KEYWORDS.some((kw) => nameLower.includes(kw))) return false;
      if (shouldHideCategory(srv.category)) return false;
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
    const base = (rate / 1000) * qty;
    return applyMarkup(base);
  }, [selectedService, quantity]);

  const pricePerHundred = useMemo(() => {
    if (!selectedService) return 0;
    const rate = Number(selectedService.rate_per_1k) || 0;
    const base = rate / 10; // rate per 100 qty
    return applyMarkup(base);
  }, [selectedService]);

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
    const min = Number(srv.min) || 1;
    setSelectedService(srv);
    setServiceId(String(srv.provider_service_id));
    setQuantity(min);
    setTarget("");
    setCustomer(createEmptyCustomer());
    const base = (Number(srv.rate_per_1k) / 1000) * min;
    setPayment((prev) => ({ ...prev, amount: applyMarkup(base) }));
    setProof(null);
    setOrder(null);
    setOrderTimestamp(null);
    setReceiptImage(null);
    setStep(1);
    setError("");
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
        <header className="mb-8">
          <div className="pointer-events-none fixed top-4 right-4 z-30 flex items-center gap-3">
            <button className="pointer-events-auto text-sm font-semibold px-4 py-1.5 rounded-full border border-white/30 text-white/80 hover:border-white hover:text-white transition">
              Masuk / Daftar
            </button>
            <div className="rounded-full bg-gradient-to-br from-purple-500/60 to-indigo-500/60 p-1 shadow-2xl shadow-purple-900/40 pointer-events-auto">
              <img
                src={BRAND_BADGE_URL}
                alt="Brand Badge"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/40 object-cover bg-white/10 backdrop-blur"
              />
            </div>
          </div>
          <div className="space-y-2 max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Premium Flow</p>
            <h1 className="text-4xl font-extrabold">Luxury Order Experience</h1>
            <p className="text-white/70 max-w-2xl">
              Pilih platform favoritmu, tentukan jenis layanan, dan nikmati proses pembayaran modern
              lengkap dengan monitoring admin.
            </p>
          </div>
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {PLATFORM_CARDS.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setSelectedPlatform(card.key)}
                  aria-pressed={selectedPlatform === card.key}
                  className={`rounded-lg border px-2.5 py-2 text-left transition shadow-sm flex items-center gap-2 text-xs bg-gradient-to-br ${card.accent} ${
                    selectedPlatform === card.key
                      ? "border-2 border-purple-400 ring-2 ring-purple-500/30 shadow-lg"
                      : "border border-purple-300/30 opacity-85 hover:opacity-100 hover:border-purple-300/70"
                  }`}
                >
                  <card.icon className="w-4 h-4" />
                  <p className="font-semibold text-xs tracking-tight">{card.label}</p>
                </button>
              ))}
            </div>

            {categoryLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <div className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60 animate-[pulse_1.2s_ease-in-out_infinite]" />
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40 animate-[pulse_1.2s_ease-in-out_infinite_150ms]" />
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20 animate-[pulse_1.2s_ease-in-out_infinite_300ms]" />
                </div>
                <span>Memuat kategori...</span>
              </div>
            ) : (
              selectedPlatform && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Kategori Layanan</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS.Other;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          aria-pressed={selectedCategory === cat}
                          className={`px-3 py-1.5 rounded-full text-[11px] border flex items-center gap-1.5 transition ${
                            selectedCategory === cat
                              ? "bg-white text-purple-900 border-purple-400 shadow"
                              : "bg-white/5 border-purple-300/30 text-white/70 hover:bg-white/10 hover:border-purple-300/60"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            <div className="space-y-3">
              <p className="text-sm uppercase tracking-wide text-white/50">
                Pilih layanan ({servicesLoading ? "memuat?" : `${filteredServices.length} opsi`})
              </p>
              {!selectedCategory ? (
                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/60">
                  Pilih kategori layanan terlebih dahulu.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-2">
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
                        aria-pressed={selected}
                        className={`text-left rounded-lg border px-2 py-1.5 text-[11px] bg-white/5 hover:bg-white/10 transition ${
                          selected
                            ? "border-purple-400 ring-2 ring-purple-500/20 shadow-lg"
                            : "border-white/10"
                        }`}
                      >
                        <p className="text-[10px] text-white/50">ID: {srv.provider_service_id}</p>
                        <p className="font-semibold text-[12px] leading-snug truncate">{srv.name}</p>
                        <p className="text-[10px] text-white/60 mb-1">{srv.category}</p>
                        <p className="text-[11px] text-white/80">Min {srv.min}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedService && (
              <>
                <label className="text-sm text-white/80 space-y-1 block">
                  Jumlah
                  <input
                    className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm outline-none"
                    type="number"
                    min={selectedService.min || 1}
                    max={selectedService.max || undefined}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                  <p className="text-xs text-white/60">
                    Estimasi harga ({formatIDR(applyMarkup((Number(selectedService.rate_per_1k) || 0) / 1000))} /1000):{" "}
                    <span className="font-semibold text-white">{formatIDR(pricePreview)}</span>
                  </p>
                </label>

                <label className="text-sm text-white/80 space-y-1 block">
                  Target
                  <input
                    className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm outline-none"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="username / link / catatan"
                  />
                </label>

                <div className="text-sm border border-white/10 rounded-2xl p-4 bg-black/20 space-y-3">
                  <p className="font-semibold text-white">Informasi Layanan</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-white/80">
                    <p>Harga per 100 qty (termasuk margin): {formatIDR(pricePerHundred)}</p>
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
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm outline-none"
                  placeholder="Nama"
                  value={customer.name}
                  onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                />
                <input
                  className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm outline-none"
                  placeholder="No. WhatsApp"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                />
                <input
                  className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm outline-none"
                  placeholder="Email"
                  value={customer.email}
                  onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                />
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!selectedService || loading}
              onClick={handleCheckout}
              className={`w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 py-2.5 font-semibold relative overflow-hidden transition ${
                loading ? "opacity-80 cursor-wait" : ""
              }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white" />
                )}
                {loading ? "Memproses..." : "Lanjutkan Pembayaran"}
              </span>
              <span
                className={`absolute inset-0 bg-white/20 blur-md transition ${
                  loading ? "opacity-100" : "opacity-0"
                }`}
              />
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
              <div className="text-sm text-white/70">Sedang membuat gambar struk?</div>
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










