import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BillboardBanner from "./components/BillboardBanner";
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
const API_FALLBACK = "https://putristore-api.vercel.app";
const AVATAR_URL =
  (import.meta?.env?.VITE_OWNER_AVATAR && import.meta.env.VITE_OWNER_AVATAR.trim()) ||
  "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=60";
const BASE_PATH = (import.meta.env?.BASE_URL || import.meta.env?.VITE_BASE_URL || "/").replace(/\/+$/, "/");
const resolveAssetPath = (path) => {
  const clean = String(path || "").trim();
  if (!clean) return "";
  if (/^(https?:)?\/\//i.test(clean) || clean.startsWith("data:")) return clean;
  const normalized = clean.replace(/^\/+/, "");
  return `${BASE_PATH}${normalized}`;
};

const BRAND_BADGE_CANDIDATES = [
  import.meta?.env?.VITE_BRAND_BADGE && import.meta.env.VITE_BRAND_BADGE.trim(),
  "assets/brand/logo.png",
  "assets/brand/brand.png",
  "assets/brand/foto.png",
];
const BRAND_BADGE_URL =
  BRAND_BADGE_CANDIDATES.map(resolveAssetPath).find((src) => typeof src === "string" && src.length) || "";
const PAYMENT_PROOF_EMAIL =
  (import.meta?.env?.VITE_PAYMENT_EMAIL && import.meta.env.VITE_PAYMENT_EMAIL.trim()) ||
  "putristore.invoice@gmail.com";
const PAYMENT_METHODS = [
  { key: "qris", label: "QRIS", icon: CreditCard, asset: "assets/payments/qris.svg" },
  { key: "dana", label: "Dana", icon: Wallet },
  { key: "gopay", label: "GoPay", icon: Smartphone },
  { key: "seabank", label: "Transfer SeaBank", icon: CreditCard },
];
const PAYMENT_ACCOUNTS = {
  dana: { number: "082322633452", owner: "Muh Agus", label: "Nomor Dana" },
  gopay: { number: "088242049163", owner: "PutriGmoyy", label: "Nomor GoPay" },
  seabank: { number: "9011-2345-6789", owner: "PutriStore", label: "Rekening SeaBank" },
};
const PAYMENT_INSTRUCTIONS = {
  qris: "Scan Qris berikut dan isi sesuai total pembayaran ( tidak boleh kurang).",
  dana: "Harap perhaikan nomor Dana dan atas nama penerima, Khusus Dana transfer wajib (+100 rupiah)",
  gopay: "Harap perhaikan nomor Gopay dan atas nama penerima,transfer tidak boleh kurang",
  seabank: "Transfer SeaBank dengan berita acara ORDER + nama kamu.",
};
const PAYMENT_MEDIA = PAYMENT_METHODS.reduce((acc, method) => {
  acc[method.key] = resolveAssetPath(method.asset);
  return acc;
}, {});
const encodeSnapshot = (payload) => {
  if (!payload) return "";
  try {
    const json = JSON.stringify(payload);
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      return window.btoa(unescape(encodeURIComponent(json)));
    }
    return json;
  } catch {
    return "";
  }
};

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
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      alert("Gagal menyalin nomor. Silakan salin manual.");
    }
  };

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
  const [payment, setPayment] = useState({ method: "qris", amount: 0, notes: "" });
  const [proof, setProof] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderTimestamp, setOrderTimestamp] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);
  const [showCopied, setShowCopied] = useState(false);
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
    setPayment((prev) => ({ ...prev, amount: 0, notes: "" }));
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
      const normalizedQuantity = Number(quantity);
      const totalCharge = Number(pricePreview) || 0;
      const perUnit = normalizedQuantity > 0 ? totalCharge / normalizedQuantity : null;
      const cleanedTarget = target.trim();
      const payload = {
        service_id: serviceId,
        quantity: normalizedQuantity,
        target: cleanedTarget,
        customer: {
          name: customer.name?.trim() || "",
          phone: customer.phone?.trim() || "",
          email: customer.email?.trim() || "",
        },
        platform: selectedPlatform,
        category: selectedCategory,
        service_name: selectedService?.name || "",
        unit_price: perUnit,
        price_total: totalCharge,
        payment_email: PAYMENT_PROOF_EMAIL,
      };
      const data = await request("/api/order/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setOrder(data.order);
      setOrderTimestamp(new Date(data.order?.created_at || Date.now()));
      setPayment((prev) => ({ ...prev, amount: totalCharge || prev.amount }));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethod = async () => {
    setError("");
    if (!order?.order_id) {
      setError("Order belum dibuat.");
      return;
    }
    if (!payment.method) {
      setError("Pilih metode pembayaran terlebih dahulu.");
      return;
    }

    const wantsUpload = Boolean(proof);
    const snapshotPayload = encodeSnapshot(order);
    if (!wantsUpload) {
      const confirmed = window.confirm(
        "Belum ada bukti transfer yang diunggah. Lanjutkan dan kirim bukti melalui email/WhatsApp?"
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const paymentPayload = {
        order_id: order.order_id,
        method: payment.method,
        amount: payment.amount || pricePreview,
        proof_channel: wantsUpload ? "upload" : "email",
        fallback_email: PAYMENT_PROOF_EMAIL,
        notes: payment.notes?.trim() || "",
        order_snapshot: snapshotPayload || order,
        order_payload: order,
        hydration_token: order?.hydration_token || "",
      };
      let updatedOrder = (
        await request("/api/order/payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentPayload),
        })
      ).order;

      if (wantsUpload && proof) {
        const form = new FormData();
        form.append("order_id", order.order_id);
        form.append("proof", proof);
        if (snapshotPayload) {
          form.append("order_snapshot", snapshotPayload);
        } else if (order) {
          form.append("order_snapshot", JSON.stringify(order));
        }
        form.append("order_payload", JSON.stringify(order));
        if (order?.hydration_token) {
          form.append("hydration_token", order.hydration_token);
        }
        const uploadResult = await request("/api/order/upload-proof", {
          method: "POST",
          body: form,
        });
        updatedOrder = uploadResult.order;
      }

      setOrder(updatedOrder);
      if (updatedOrder?.created_at) {
        setOrderTimestamp(new Date(updatedOrder.created_at));
      }
      setStep(3);
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
    setPayment((prev) => ({ ...prev, amount: applyMarkup(base), notes: "" }));
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
    ctx.font = "bold 42px 'Poppins', sans-serif";
    ctx.fillText("Struk Order Putri Gmoyy", 120, 110);

    ctx.font = "20px 'Poppins', sans-serif";
    ctx.textBaseline = "top";
    const orderCustomer = liveCustomer;
    const paymentLabel =
      PAYMENT_METHODS.find((m) => m.key === (order.payment?.method || payment.method))?.label || "-";
    const nominal = order.payment?.amount ?? payment.amount ?? pricePreview;
    const details = [
      ["Order ID", order.order_id],
      ["Platform", order.platform || selectedPlatform || "-"],
      ["Kategori", order.category || selectedCategory || "-"],
      [
        "Layanan",
        order.service_name || selectedService?.name
          ? `${order.service_name || selectedService?.name || "-"} (${order.service_id})`
          : order.service_id,
      ],
      ["Target", order.target],
      ["Quantity", (order.quantity ?? 0).toLocaleString("id-ID")],
      ["Nama", orderCustomer?.name || "-"],
      ["No. WhatsApp", orderCustomer?.phone || "-"],
      ["Email", orderCustomer?.email || "-"],
      ["Metode Bayar", paymentLabel],
      ["Nominal", formatIDR(nominal)],
      [
        "Waktu Order",
        orderTimestamp
          ? `${formatWitaDate(orderTimestamp)} � ${formatWitaTime(orderTimestamp)}`
          : "-",
      ],
    ];

    const labelX = 100;
    const valueX = 310;
    const maxValueWidth = canvas.width - valueX - 120;
    let y = 180;
    const lineHeight = 32;

    const wrapText = (text, startY) => {
      const content = String(text || "-").trim() || "-";
      const words = content.split(/\s+/);
      let line = "";
      let currentY = startY;
      ctx.textAlign = "left";

      words.forEach((word, idx) => {
        const testLine = line ? `${line} ${word}` : word;
        const width = ctx.measureText(testLine).width;
        if (width > maxValueWidth && line) {
          ctx.fillText(line, valueX, currentY);
          line = word;
          currentY += lineHeight;
        } else {
          line = testLine;
        }

        if (idx === words.length - 1) {
          ctx.fillText(line, valueX, currentY);
          currentY += lineHeight;
        }
      });

      return currentY;
    };

    details.forEach(([label, value]) => {
      ctx.fillStyle = "#bfa7ff";
      ctx.textAlign = "left";
      ctx.fillText(`${label}:`, labelX, y);
      ctx.fillStyle = "#fff";
      const nextY = wrapText(value, y);
      y = Math.max(nextY, y + lineHeight);
    });

    ctx.fillStyle = "#a78bfa";
    ctx.font = "16px 'Poppins', sans-serif";
    ctx.textBaseline = "alphabetic";
    const totalHeight = y - 180;
    if (totalHeight > 350) {
      const scale = Math.min(1, 350 / totalHeight);
      ctx.save();
      ctx.translate(90, 170);
      ctx.scale(scale, scale);
      ctx.translate(-90, -170);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "16px 'Poppins', sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Terima kasih telah memesan layanan kami.", 120, 560);

      ctx.font = "13px 'Poppins', sans-serif";
      const watermark = "� PutriStore Premium Service";
      const wmWidth = ctx.measureText(watermark).width;
      ctx.fillText(watermark, canvas.width - wmWidth - 60, canvas.height - 30);
      ctx.restore();
    } else {
      ctx.fillStyle = "#a78bfa";
      ctx.font = "16px 'Poppins', sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Terima kasih telah memesan layanan kami.", 120, 560);

      ctx.font = "13px 'Poppins', sans-serif";
      const watermark = "� PutriStore Premium Service";
      const wmWidth = ctx.measureText(watermark).width;
      ctx.fillText(watermark, canvas.width - wmWidth - 60, canvas.height - 30);
    }

    setReceiptImage(canvas.toDataURL("image/png"));
  };

  useEffect(() => {
    if (step >= 3 && order) {
      generateReceiptImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, order]);

  useEffect(() => {
    if (step === 1) {
      setPayment((prev) => ({ ...prev, amount: pricePreview }));
    }
  }, [pricePreview, step]);

  const menuItems = [
    {
      label: "Order",
      action: () => {
        setMenuOpen(false);
        orderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    },
    {
      label: "Panduan",
      action: () => {
        setMenuOpen(false);
        window.open("https://wa.me/6281234567890?text=Halo%20kak%2C%20minta%20panduan%20order%20dong", "_blank", "noopener");
      },
    },
    {
      label: "Informasi",
      action: () => {
        setMenuOpen(false);
        window.open("https://t.me/+monitoringsosmed", "_blank", "noopener");
      },
    },
    {
      label: "Daftar Harga",
      action: () => {
        setMenuOpen(false);
        window.open("https://docs.google.com/spreadsheets/d/your_price_list_id", "_blank", "noopener");
      },
    },
    {
      label: "Kontak & Owner Info",
      action: () => {
        setMenuOpen(false);
        window.open("https://wa.me/6281234567890?text=Halo%20Owner", "_blank", "noopener");
      },
    },
    {
      label: "Testimoni",
      action: () => {
        setMenuOpen(false);
        window.open("https://instagram.com/stories/highlights/your_highlight_id", "_blank", "noopener");
      },
    },
    { label: "Admin", action: () => { setMenuOpen(false); navigate("/admin"); } },
    { label: "Status Order", action: () => { setMenuOpen(false); handleStatusCheck(); } },
  ];

  const resetFlow = () => {
    setStep(1);
    setOrder(null);
    setPayment({ method: "qris", amount: 0, notes: "" });
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

  const liveCustomer = order?.customer || customer;
  const livePlatform = order?.platform || selectedPlatform || "-";
  const liveCategory = order?.category || selectedCategory || "-";
  const liveServiceName = order?.service_name || selectedService?.name || "-";
  const livePaymentAmount = order?.payment?.amount ?? payment.amount ?? pricePreview;

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
            Putri Gmoyy Store
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
        <BillboardBanner />
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
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Putri Gmoyy Store</p>
            <h1 className="text-4xl font-extrabold">Putri Gmoyy Sosmed</h1>
            <p className="text-white/70 max-w-2xl">
              Jasa kebutuhan sosmed aman, murah dan terpercaya. Langsung saja order dibawah ini maniezz...
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
                    Total harga{" "}
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
                  <div className="text-white/80 space-y-1">
                    <p>Min Order: {selectedService.min}</p>
                    <p>Max Order: {selectedService.max}</p>
                    <p>Harga / 100: {formatIDR(pricePerHundred)}</p>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed text-white/70">
                    {selectedService.description || "Deskripsi belum tersedia dari panel."}
                  </p>
                </div>
              </>
            )}

            <fieldset className="rounded-2xl border border-white/10 p-4 space-y-3">
              <legend className="px-2 text-sm text-white/60">Data Pemesan (Opsional)</legend>
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
              {[
                { label: "Order ID", value: order.order_id },
                { label: "ID Layanan", value: order.service_id },
                { label: "Nama Layanan", value: liveServiceName },
                { label: "Platform", value: livePlatform },
                { label: "Kategori", value: liveCategory },
                { label: "Jumlah Order", value: order.quantity?.toLocaleString("id-ID") },
                { label: "Target", value: order.target, span: true },
                { label: "Nama Pemesan", value: liveCustomer?.name || "-" },
                { label: "Nomor WhatsApp", value: liveCustomer?.phone || "-" },
                { label: "Email", value: liveCustomer?.email || "-" },
                {
                  label: "Waktu Order",
                  value: orderTimestamp
                    ? `${formatWitaDate(orderTimestamp)} � ${formatWitaTime(orderTimestamp)}`
                    : "-",
                },
              ].map((item) => (
                <div key={`${item.label}-${item.value}`} className={item.span ? "sm:col-span-2" : ""}>
                  <p className="text-white/50">{item.label}</p>
                  <p className="font-semibold break-words">{item.value}</p>
                </div>
              ))}
            </div>

            <div
              className="rounded-2xl border border-purple-400/30 bg-black/30 p-4 flex flex-col gap-2"
              style={{ marginTop: "10%" }}
            >
              <p className="text-sm text-white/60">Total Pembayaran</p>
              <p className="text-3xl font-bold">{formatIDR(livePaymentAmount)}</p>
              <p className="text-xs text-white/50">
                Harap transer sesuai jumlah diatas.
              </p>
            </div>

            <div className="space-y-4">
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
              {payment.method === "qris" ? (
                <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-white/70 space-y-3 text-center">
                  {PAYMENT_MEDIA[payment.method] ? (
                    <img
                      src={PAYMENT_MEDIA[payment.method]}
                      alt={payment.method}
                      className="mx-auto max-w-[300px] rounded-xl border border-white/10"
                    />
                  ) : (
                    <p className="text-xs text-white/60">
                      Letakkan gambar QRIS pada <code>public/assets/payments/qris.svg</code>.
                    </p>
                  )}
                  <p className="text-xs text-white/60">{PAYMENT_INSTRUCTIONS[payment.method]}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-white/80 space-y-3">
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wide">Nomor Rekening</p>
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-white/10 px-4 py-2">
                      <p className="font-semibold text-lg">{PAYMENT_ACCOUNTS[payment.method]?.number || "-"}</p>
                      <button
                        type="button"
                        onClick={() => handleCopy(PAYMENT_ACCOUNTS[payment.method]?.number || "")}
                        className="text-xs px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition"
                      >
                        Salin
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wide">Atas Nama</p>
                    <p className="font-semibold text-white">{PAYMENT_ACCOUNTS[payment.method]?.owner || "-"}</p>
                  </div>
                  <p className="text-xs text-white/60">{PAYMENT_INSTRUCTIONS[payment.method]}</p>
                  {showCopied && (
                    <p className="text-emerald-300 text-xs text-right">Nomor rekening sudah disalin ke clipboard.</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70 space-y-2">
                <p className="text-white font-semibold text-base">Informasi Pembayaran</p>
                <p>
                  Pastikan jumlah transfer sesuai dengan total di atas dan sertakan berita acara{" "}
                  <span className="font-semibold text-white">ORDER + Nama Kamu</span>. Bukti pembayaran yang jelas akan
                  mempercepat proses verifikasi admin.
                </p>
              </div>
              <label className="text-sm text-white/80 space-y-2 block">
                Upload Bukti Pembayaran (opsional)
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
              <p className="text-xs text-white/60">
                Jika terkendala upload, kirim bukti tf via whatsapp grup di https://chat.whatsapp.com/Gpl3XMxuiVTGHbyEkaEoz6 , lalu klik tombol lanjut dibawah.{" "}
                <a
                  href={`mailto:${PAYMENT_PROOF_EMAIL}?subject=Bukti%20Transfer%20${encodeURIComponent(order.order_id)}`}
                  className="text-white underline"
                >
                  {PAYMENT_PROOF_EMAIL}
                </a>{" "}
                atau WhatsApp admin, lalu klik tombol di bawah.
              </p>
              <button
                onClick={handlePaymentMethod}
                disabled={loading}
                className="w-full rounded-2xl bg-green-500 py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Saya sudah bayar"}
              </button>
              <p className="text-xs text-white/50 text-center">
                Data order akan tertahan di admin selama maksimal 1x24 jam untuk diverifikasi sebelum otomatis
                dibatalkan.
              </p>
            </div>
          </section>
        )}

        {step === 3 && order && (
          <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-4">
            {renderStepTitle("3", "Struk Menunggu Konfirmasi")}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70 space-y-1">
              <p className="text-white/50">Status saat ini</p>
              <p className="text-lg font-semibold capitalize">{String(order.status || "Menunggu_Konfirmasi_Admin").replace(/_/g, " ")}</p>
              <p>
                Waktu Verifikasi :{" "}
                {order.review_deadline
                  ? `${formatWitaDate(new Date(order.review_deadline))} � ${formatWitaTime(
                      new Date(order.review_deadline)
                    )}`
                  : "Menunggu admin"}
              </p>
              <p>
                Bukti bayar:{" "}
                {order.payment?.proof_status === "uploaded"
                  ? "Sudah diterima"
                  : order.payment?.proof_status === "awaiting_email"
                  ? "Menunggu bukti via email"
                  : "Belum ada"}
              </p>
              <p className="text-xs text-white/50">
                Admin akan memeriksa secepatnya jika dalam 10 menit tidak ada kabar dari admin, silahkan tag admin di grup untuk mempercepat proses.
                
              </p>
            </div>
            {receiptImage ? (
              <img
                src={receiptImage}
                alt="Struk Premium"
                className="w-full rounded-2xl border border-white/20"
              />
            ) : (
              <div className="text-sm text-white/70">Sedang membuat gambar struk...</div>
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
                Lanjut ke Grup WhatsApp
              </button>
              <button
                onClick={handleStatusCheck}
                className="rounded-2xl border border-white/20 py-3 font-semibold text-white/80 flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Status Order
              </button>
            </div>
            <p className="text-xs text-white/60">
              Setelah pembayaran disetujui, Order akan otomatis diproses silahkan pantau status order secara berkala.
              
            </p>
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
