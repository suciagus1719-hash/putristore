import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "./config";
import { motion } from "framer-motion";
import {
  Instagram, Youtube, Facebook, Linkedin, Twitter,
  Search, ArrowRight, Loader2, ShieldCheck, Sparkles, Star, ChevronLeft
} from "lucide-react";


/* ---- Custom SVG icons (TikTok & Telegram) ---- */
const TikTokIcon = (props) => (
  <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M30 6c1.2 3.9 4.2 7 8 8v5.4c-3.2-.3-6.2-1.5-8-3.3v11.8c0 6.5-5.3 11.8-11.8 11.8S6.4 34.4 6.4 27.9 11.7 16 18.2 16c1.2 0 2.3.2 3.4.6v5.8c-.9-.5-2-.8-3.1-.8-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V6h5.5z"/>
  </svg>
);
const TelegramIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M9.04 12.6 4.2 11.1c-.53-.16-.56-.89-.06-1.11L18.99 4.8c.43-.18.87.22.75.68l-2.9 10.9c-.13.52-.73.75-1.15.44l-2.46-1.82-3.2 1.76c-.31.17-.68-.11-.58-.45l1.53-4.4 8-7-8.9 5.66z"/>
  </svg>
);
function safeNum(v) {
  return (v === null || v === undefined) ? "-" : String(v);
}
function formatMoney(v) {
  try { return new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(v)); }
  catch { return v; }
}
function formatDate(v) {
  if (!v) return "-";
  // panel kadang kirim "YYYY-MM-DD HH:mm:ss" (tanpa zona). Tampilkan apa adanya jika Date gagal.
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long", timeStyle: "medium"
  }).format(d);
}

/* Map platform -> icon component */
const PLATFORM_ICONS = {
  Instagram, YouTube: Youtube, Facebook, LinkedIn: Linkedin,
  Twitter, "Twitter/X": Twitter, TikTok: TikTokIcon, Telegram: TelegramIcon, Other: Sparkles,
};
// helper: kembalikan komponen ikon berdasar nama platform apa pun variannya
const getPlatformIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("tiktok")) return TikTokIcon;
  if (n.includes("youtube")) return Youtube;
  if (n.includes("instagram")) return Instagram;
  if (n.includes("facebook")) return Facebook;
  if (n.includes("telegram")) return TelegramIcon;
  if (n.includes("twitter") || n.includes("x")) return Twitter;
  if (n.includes("shopee") || n.includes("tokopedia") || n.includes("bukalapak")) return Sparkles;
  return Sparkles; // default
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih Salah Satu",
  leftIcon: LeftIcon, // ikon bisa undefined
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = value || "";

  // 🔧 tambahkan guard: pastikan LeftIcon adalah fungsi valid
  const RenderIcon = LeftIcon || null;


  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full p-3 rounded-xl border border-white/10 bg-white/10 text-left flex items-center gap-2"
      >
        {RenderIcon && <RenderIcon className="h-5 w-5 text-zinc-300" />}
        <span className={selectedLabel ? "" : "text-zinc-400"}>
          {selectedLabel || placeholder}
        </span>
        <span className="ml-auto text-zinc-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur p-2 shadow-lg">
          <input
            autoFocus
            className="w-full p-2 mb-2 rounded-lg border border-white/10 bg-white/10"
            placeholder="Cari kategori…"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />
          <div className="max-h-64 overflow-auto pr-1">
            {filtered.length === 0 && (
              <div className="text-sm text-zinc-400 p-2">Tidak ada hasil</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.name}
                className="w-full text-left p-2 rounded-lg hover:bg-white/10 flex items-center gap-2"
                onClick={() => { onChange(opt.name); setOpen(false); }}
              >
                {RenderIcon && <RenderIcon className="h-4 w-4 text-zinc-300" />}
                <span>{opt.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ====== KATEGORI PER PLATFORM (EDIT DI SINI SAJA) ====== */
// Ubah/ambah item di tiap array sesuai kebutuhanmu
const CATEGORY_LIBRARY = {
  Instagram: [
    { name: "Followers" },
    { name: "Likes" },
    { name: "Views" },
    { name: "Comments" },
    { name: "Story Views" },
  ],
  TikTok: [
    { name: "Followers" },
    { name: "Views" },
    { name: "Likes" },
    { name: "Comments" },
    { name: "Shares" },
  ],
  "Twitter/X": [
    { name: "Followers" },
    { name: "Likes" },
    { name: "Views" },
    { name: "Retweets" },
  ],
  YouTube: [
    { name: "Subscribers" },
    { name: "Views" },
    { name: "Likes" },
    { name: "Comments" },
  ],
  Facebook: [
    { name: "Followers" },
    { name: "Likes" },
    { name: "Comments" },
    { name: "Shares" },
  ],
  Telegram: [
    { name: "Members" },
    { name: "Views" },
    { name: "Reactions" },
  ],
  Shopee: [
    { name: "Shopee / Bukalapak / Tokopedia" },
    { name: "Product Views" },
    { name: "Shop Followers" },
  ],
  Other: [
    { name: "Custom" },
  ],
};
/* ==== Deskripsi custom (opsional) ==== */
// Kunci pakai provider_service_id dari API, atau pakai nama unikmu sendiri.
// Contoh:
const SERVICE_DESC_OVERRIDE = {
  // "123456": "Followers real, refill 30 hari. Start 0–10 menit.",
  // "78910": "Views cepat, cocok untuk video terbaru.",
};

/* ====== END KATEGORI PER PLATFORM ====== */
const calcPrice = (svc, qty) => {
  if (!svc || !qty) return null;
  // Banyak panel mengirim rate per 1000
  const rate = Number(svc.rate_per_1k ?? svc.price_per_1000 ?? 0);
  if (!rate) return null;
  return Math.ceil((rate / 1000) * Number(qty));
};


function cx(...c){ return c.filter(Boolean).join(" "); }

export default function LuxuryOrderFlow({
  apiBase = API_BASE,
  bannerImages = [
    "https://images.unsplash.com/photo-1522071901873-411886a10004?auto=format&w=1200&q=60",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&w=1200&q=60",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&w=1200&q=60"
  ]
}) {
  /* ---- state ---- */
  const [platforms, setPlatforms] = useState(["TikTok","Twitter/X","Instagram","YouTube","Facebook","Telegram","Other"]);
  const [actions, setActions] = useState([]);
  const [services, setServices] = useState([]);
  const [platform, setPlatform] = useState("");
  const [action, setAction] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [selectedService, setSelectedService] = useState(null);
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [preview, setPreview] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bannerIdx, setBannerIdx] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartXRef = useRef(null);
  const touchCurrentXRef = useRef(null);
  // === Status Order ===
const [statusOrderId, setStatusOrderId] = useState("");
const [statusData, setStatusData] = useState(null);
const [statusLoading, setStatusLoading] = useState(false);
const [statusError, setStatusError] = useState("");


// section refs (agar menu bisa scroll ke bagian tertentu)
const orderRef = useRef(null);
const statusRef = useRef(null);
const monitoringRef = useRef(null);
const priceRef = useRef(null);

// (opsional) toggle admin menu
const IS_ADMIN = true; // ganti ke false jika ingin menyembunyikan menu admin

  /* ---- effects ---- */
  useEffect(()=>{ const id = setInterval(()=>setBannerIdx(i=>(i+1)%bannerImages.length), 4000); return ()=>clearInterval(id); }, [bannerImages.length]);

  // 1) muat platform (beranda)
  useEffect(()=>{
    fetch(`${apiBase}/api/platforms`).then(r=>r.json()).then(arr=>{
      if(Array.isArray(arr) && arr.length) setPlatforms(arr);
    }).catch(()=>{});
  },[apiBase]);

  // 2) saat platform dipilih → ambil kategori (actions)
  useEffect(()=>{
    if(!platform) return;
    setLoading(true); setError("");
    fetch(`${apiBase}/api/actions?platform=${encodeURIComponent(platform)}`)
      .then(r=>r.json())
      .then(d=>{ setActions(d?.length?d:["Followers","Likes","Views","Shares","Comments","Other"]); })
      .finally(()=>setLoading(false));
  },[platform, apiBase]);

  // 3) saat kategori dipilih → ambil layanan
  useEffect(()=>{
    if(!platform || !action) return;
    setLoading(true); setError("");
    fetch(`${apiBase}/api/services?platform=${encodeURIComponent(platform)}&action=${encodeURIComponent(action)}`)
      .then(r=>r.json())
      .then(d=>{ setServices(Array.isArray(d)?d:[]); })
      .finally(()=>setLoading(false));
  },[action, platform, apiBase]);

  // 4) set selectedService dari serviceId
  useEffect(()=>{
    const s = services.find(x=>String(x.provider_service_id)===String(serviceId));
    setSelectedService(s||null);
    if(s){ setQuantity(q=>Math.min(Math.max(q, s.min||1), s.max||q)); }
  },[serviceId, services]);

 
// 5) preview harga (instan — tanpa delay)
useEffect(() => {
  setPreview(calcPrice(selectedService, quantity));
}, [selectedService, quantity]);



  const canCheckout = useMemo(()=>(
    selectedService && link.trim() &&
    quantity >= (selectedService?.min ?? 1) &&
    quantity <= (selectedService?.max ?? 1)
  ), [selectedService, link, quantity]);

  const handleCheckout = async()=>{
    if(!canCheckout) return;
    setLoading(true); setError("");
    try{
      const r = await fetch(`${apiBase}/api/order/checkout`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          provider_service_id:selectedService.provider_service_id,
          link, quantity, nama:"Guest", komen:"", username:""
        })
      });
      const j = await r.json();
      if(j?.invoice){ setInvoice(j.invoice); }
      else { setError("Gagal membuat invoice"); }
    }catch(e){ setError(String(e)); }
    finally{ setLoading(false); }
  };

  // Ambil status order dari backend (yang meneruskan ke panel SMM)


const fetchOrderStatus = async (id) => {
  if (!id?.trim()) { setStatusError("Masukkan nomor order terlebih dahulu"); return; }
  setStatusError(""); setStatusData(null); setStatusLoading(true);

  try {
    const r = await fetch(`${apiBase}/api/order/status?order_id=${encodeURIComponent(id.trim())}`, {
      headers: { "Accept": "application/json" },
    });
    const j = await r.json();
// === simpan meta order ke backend ===
if (j?.order_id) {
  await fetch(`${apiBase}/api/order/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: selectedService?.provider_service_id,
      link,
      quantity,
      service_name: selectedService?.name,
      charge: preview || null,      // harga yang ditampilkan user
    }),
  });
}
if (j?.invoice) { 
  setInvoice(j.invoice);
} else { 
  setError("Gagal membuat invoice"); 
}


    if (r.ok && (j.status || j.order_id)) {
      // 🔁 gabungkan metadata lokal (kalau ada)
      const meta = getOrderMeta(id.trim());
      const merged = {
        ...j,
        target: j.target ?? meta?.target ?? null,
        service_name: j.service_name ?? meta?.service_name ?? null,
        quantity: j.quantity ?? meta?.quantity ?? null,
        charge: j.charge ?? meta?.charge ?? null,
        created_at: j.created_at ?? meta?.created_at ?? null,
      };
      setStatusData(merged);
      return;
    }

    throw new Error(j?.message || "Gagal mengambil status");
  } catch (e) {
    setStatusError(String(e.message || e));
  } finally {
    setStatusLoading(false);
  }
};


{/* HASIL STATUS */}
{statusData && (
  <div className="rounded-2xl bg-zinc-900/60 p-4 md:p-6 border border-white/10 space-y-2 text-zinc-200">
    <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
      <p><span className="text-zinc-400">Status:</span> <b>{statusData.status ?? "-"}</b></p>
      <p><span className="text-zinc-400">Provider Order:</span> {statusData.provider_order ?? "-"}</p>

      <p><span className="text-zinc-400">Order ID:</span> {statusData.order_id ?? "-"}</p>
      <p><span className="text-zinc-400">Remains:</span> {safeNum(statusData.remains)}</p>
<p><span className="text-zinc-400">Target:</span> {statusData.target ?? "-"}</p>
<p><span className="text-zinc-400">Layanan:</span> {statusData.service_name ?? "-"}</p>
      <p><span className="text-zinc-400">Start Count:</span> {safeNum(statusData.start_count)}</p>
      <p><span className="text-zinc-400">Charge:</span> {statusData.charge != null ? formatMoney(statusData.charge) : "-"}</p>

      <p className="md:col-span-2"><span className="text-zinc-400">Target:</span> {statusData.target ?? "-"}</p>
      <p className="md:col-span-2"><span className="text-zinc-400">Layanan:</span> {statusData.service_name ?? "-"}</p>
      <p><span className="text-zinc-400">Jumlah:</span> {safeNum(statusData.quantity)}</p>
      <p><span className="text-zinc-400">Tanggal & Waktu:</span> {formatDate(statusData.created_at)}</p>
    </div>

    <button
      onClick={() => fetchOrderStatus(statusOrderId)}
      className="mt-3 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
    >
      Refresh Status
    </button>
  </div>
)}


  /* ---- UI helpers ---- */
  const GradientBg = () => (
    <div className="absolute inset-0 -z-10">
      <div className="absolute -top-20 -left-32 h-72 w-72 rounded-full bg-fuchsia-500/30 blur-3xl"/>
      <div className="absolute top-48 -right-24 h-80 w-80 rounded-full bg-purple-600/25 blur-3xl"/>
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl"/>
    </div>
  );
  const scrollToRef = (ref) => {
  setDrawerOpen(false);
  if (ref?.current) {
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};


  const Header = () => (
    <div className="sticky top-0 z-30 backdrop-blur bg-zinc-950/60 border-b border-white/10">
      <div className="max-w-6xl mx-auto p-3 flex items-center gap-3">
        {invoice && (
          <button onClick={()=>setInvoice(null)} className="p-2 rounded-xl border border-white/10 hover:bg-white/5">
            <ChevronLeft className="h-5 w-5"/>
          </button>
        )}
    <button
  onClick={() => setDrawerOpen(true)}
  className="shrink-0 h-8 w-8 rounded-xl border border-fuchsia-400 overflow-hidden flex items-center justify-center bg-fuchsia-500/20"
  aria-label="Buka menu"
>
  <img
    src={`${import.meta.env.BASE_URL}logo.png`}
    alt="Putri Gmoyy Logo"
    className="h-full w-full object-cover"
    onError={(e) => {
      // sembunyikan img, tampilkan fallback di dalam button
      e.currentTarget.style.display = 'none';
      const fallback = document.createElement('span');
      fallback.textContent = 'P';
      fallback.className = 'text-xs font-bold text-fuchsia-200';
      e.currentTarget.parentElement?.appendChild(fallback);
    }}
  />
</button>


            <span className="font-semibold ml-2">Putri Gmoyy Store</span>

        <div className="ml-auto flex items-center gap-3">
          <button onClick={()=>setShowSearch(s=>!s)} className="p-2 rounded-xl border border-white/10 hover:bg-white/5">
            <Search className="h-5 w-5"/>
          </button>
          <div className="text-xs text-zinc-300 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4"/> silahkan order
          </div>
        </div>
      </div>

      {/* banner carousel */}
      <div className="max-w-6xl mx-auto px-3 pb-3">
        <div className="relative h-28 sm:h-32 rounded-2xl overflow-hidden bg-gradient-to-r from-fuchsia-600/40 via-purple-600/30 to-indigo-600/30 border border-white/10">
          {bannerImages.map((src,i)=>(
            <img key={i} loading="lazy" src={src} alt="banner"
                 className={cx("absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
                               bannerIdx===i?"opacity-100":"opacity-0")} />
          ))}
          <div className="absolute inset-0 bg-black/30"/>
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <div className="text-sm uppercase tracking-wide text-white/80">Pengumuman</div>
            <div className="font-semibold">Diskon & Info Layanan Terbaru</div>
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="border-t border-white/10 bg-zinc-950/80">
          <div className="max-w-6xl mx-auto p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"/>
              <input className="w-full pl-10 pr-3 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-zinc-400 focus:outline-none"
                     placeholder="Cari layanan, mis. Instagram Followers Indonesia"/>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ---- RENDER ---- */
  if (invoice) {
    // Halaman pembayaran setelah klik "Lanjutkan Pembayaran"
    return (
      <div className="min-h-[100svh] relative bg-gradient-to-b from-zinc-950 to-black text-zinc-50">
        <GradientBg/>
        <Header/>
        {/* ===== Drawer Menu (left) ===== */}
{/* Overlay */}
{drawerOpen && (
  <div
    className="fixed inset-0 z-40 bg-black/50"
    onClick={() => setDrawerOpen(false)}
  />
)}
{/* Panel */}
<div
  className={cx(
    "fixed top-0 left-0 z-50 h-full w-72 max-w-[85%] bg-zinc-900 border-r border-white/10 shadow-2xl transition-transform",
    drawerOpen ? "translate-x-0" : "-translate-x-full"
  )}
  role="dialog"
  aria-label="Menu"
>
  <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
    <div className="p-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/30">PPS</div>
    <div className="font-semibold">Putri Gmoyy Store</div>
    <button onClick={() => setDrawerOpen(false)} className="ml-auto text-zinc-400 hover:text-white">✕</button>
  </div>

  <div className="p-3 text-xs text-zinc-400">MENU UTAMA</div>
  <nav className="px-2 space-y-1">
    <button onClick={() => scrollToRef(orderRef)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5">
      🏠 Beranda / Order
    </button>
    <button onClick={() => scrollToRef(statusRef)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5">
      🧾 Status Order
    </button>
    <button onClick={() => scrollToRef(monitoringRef)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5">
      ✅ Monitoring Sosmed
    </button>
    <button onClick={() => scrollToRef(priceRef)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5">
      🏷️ Daftar Harga
    </button>
  </nav>

  {IS_ADMIN && (
    <>
      <div className="p-3 mt-4 text-xs text-zinc-400">ADMIN</div>
      <nav className="px-2 space-y-1">
        <a href="#admin-panel" className="block px-3 py-2 rounded-lg hover:bg-white/5">⚙️ Panel Admin</a>
        <a href="#admin-services" className="block px-3 py-2 rounded-lg hover:bg-white/5">🧩 Kelola Layanan</a>
        <a href="#admin-orders" className="block px-3 py-2 rounded-lg hover:bg-white/5">📦 Kelola Order</a>
      </nav>
    </>
  )}
</div>

        <main className="max-w-2xl mx-auto px-4 py-10">
          <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-purple-600/10 p-6 text-center">
            <Sparkles className="h-8 w-8 mx-auto text-fuchsia-400"/>
            <h2 className="text-2xl font-bold mt-2">Pembayaran</h2>
            <p className="text-zinc-300 mt-1">Selesaikan pembayaran untuk memproses pesananmu.</p>
            <div className="mt-4 text-xl">Nominal: <strong>Rp {invoice?.amount}</strong></div>
            {invoice?.invoice_url && (
              <a className="inline-flex items-center gap-2 mt-5 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white"
                 href={invoice.invoice_url} target="_blank" rel="noreferrer">
                Buka Invoice <ArrowRight className="h-4 w-4"/>
              </a>
            )}
            <div className="text-xs text-zinc-400 mt-4">Setelah bayar, sistem otomatis menandai pesanan dan menjalankan layanan.</div>
          </motion.section>
        </main>
        <footer className="py-10 text-center text-xs text-zinc-500">© {new Date().getFullYear()} Aurum Panel — crafted with care</footer>
      </div>
    );
  }

  // Beranda + Quick Order (semua di satu halaman)
  return (
    <div
   className="min-h-[100svh] relative bg-gradient-to-b from-zinc-950 to-black text-zinc-50"
   onTouchStart={(e) => {
     touchStartXRef.current = e.touches[0].clientX;
     touchCurrentXRef.current = e.touches[0].clientX;
   }}
   onTouchMove={(e) => {
     const x = e.touches[0].clientX;
     const start = touchStartXRef.current ?? x;
     touchCurrentXRef.current = x;
     const delta = x - start;
     // buka saat swipe kanan dari tepi kiri
     if (!drawerOpen && start < 24 && delta > 60) setDrawerOpen(true);
      if (!drawerOpen && start > window.innerWidth - 24 && delta < -60) setDrawerOpen(true);
     // tutup saat swipe kiri ketika drawer terbuka
     if (drawerOpen && delta < -60) setDrawerOpen(false);
   }}
   onTouchEnd={() => {
     touchStartXRef.current = null;
     touchCurrentXRef.current = null;
   }}
 >
      <GradientBg/>
      <Header/>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* HEADLINE */}
        <motion.section ref={orderRef} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 border border-white/10 text-xs">
            <Star className="h-4 w-4 text-amber-400"/> Putri Gmoyy Sosmed
          </div>
          <h1 className="text-4xl font-extrabold mt-4 bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-purple-300 to-indigo-300">
            Silahkan Pilih Dan Order Langsung Kebutuhan Sosmedmu Di Bawah Ini Ya.
          </h1>
          <p className="text-zinc-300 mt-2">Semua serba otomatis, proses cepat dan aman.</p>
        </motion.section>

        {/* PILIH PLATFORM (klik kartu atau ketik) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {platforms.map(name=>{
            const Icon = getPlatformIcon(name);
            return (
              <motion.button key={name} whileHover={{y:-2}} whileTap={{scale:0.98}}
                onClick={()=>setPlatform(name)}
                className={cx(
                  "group p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-fuchsia-500/[.06] hover:from-white/10 hover:to-fuchsia-500/10 shadow-sm",
                  platform===name && "ring-2 ring-fuchsia-400"
                )}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30">
                    <Icon className="h-6 w-6"/>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">{name}</div>
                    <div className="text-xs text-zinc-400">Klik untuk mulai</div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Input platform manual */}
        <div className="mt-4">
          <input
            list="platform-list"
            className="w-full p-3 rounded-xl border border-white/10 bg-white/10"
            placeholder="Atau ketik: Instagram, TikTok, YouTube, ..."
            value={platform}
            onChange={(e)=>setPlatform(e.target.value)}
          />
          <datalist id="platform-list">
            {platforms.map(p => <option key={p} value={p} />)}
          </datalist>
        </div>

       {/* KATEGORI (dropdown dengan pencarian + ikon) */}
{!!platform && (
  <div className="mt-6">
    <div className="text-sm mb-1">Kategori *</div>

    <SearchableSelect
      value={action}
      onChange={setAction}
      // ambil dari library; kalau kosong fallback ke data API lama
      options={(CATEGORY_LIBRARY[platform] || (actions || []).map(a => ({ name: a })))}
      placeholder="Pilih Salah Satu"
     leftIcon={getPlatformIcon(platform)}

    />
  </div>
)}


        {/* LAYANAN (nama saja) */}
        {!!action && (
          <div className="mt-6">
            <div className="text-sm mb-2">Layanan *</div>
            <div className="space-y-3 max-h-64 overflow-auto rounded-xl p-2 bg-white/5 border border-white/10">
              {loading && <div className="p-3 text-sm text-zinc-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Memuat layanan…</div>}
              {!loading && !services.length && <div className="p-3 text-sm text-zinc-400">Tidak ada layanan untuk kategori ini.</div>}
              {services.map(s => (
                <label key={s.provider_service_id}
                       className={cx("block p-3 rounded-xl border border-white/10 cursor-pointer bg-white/5 hover:bg-white/10",
                                     String(serviceId)===String(s.provider_service_id) && "ring-2 ring-fuchsia-400")}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio" name="svc" className="mt-1"
                      checked={String(serviceId)===String(s.provider_service_id)}
                      onChange={()=>setServiceId(String(s.provider_service_id))}
                    />
                    <div className="font-semibold">{s.name}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* TARGET + JUMLAH + TOTAL + BUTTON */}
        {!!selectedService && (
          <div className="mt-6 space-y-4">
            <div>
              <div className="text-sm mb-1">Target / Link</div>
              <input
                className="w-full p-3 rounded-xl border border-white/10 bg-white/10"
                placeholder="https://… atau @username"
                value={link}
                onChange={e=>setLink(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm mb-1">
                Jumlah {selectedService && <span className="text-xs text-zinc-400">(min {selectedService.min} / max {selectedService.max})</span>}
              </div>
              <input
                type="number"
                min={selectedService?.min||1}
                max={selectedService?.max||100000}
                className="w-full p-3 rounded-xl border border-white/10 bg-white/10"
                value={quantity}
                onChange={e=>setQuantity(Number(e.target.value)||0)}
              />
            </div>

            <div className="rounded-xl p-3 bg-gradient-to-br from-fuchsia-600/15 to-purple-600/15 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="text-lg">Total: <strong>{preview!=null?`Rp ${preview}`:'-'}</strong></div>
                <button
                  disabled={!canCheckout || loading}
                  onClick={handleCheckout}
                  className={cx("px-4 py-3 rounded-xl text-white bg-gradient-to-r from-fuchsia-600 to-purple-600",
                                (!canCheckout||loading)&&"opacity-60 cursor-not-allowed")}
                >
                  Lanjutkan Pembayaran
                </button>
              </div>
            </div>

      {/* Deskripsi layanan (judul + isi, bisa override) */}
{(() => {
  const desc =
    SERVICE_DESC_OVERRIDE?.[selectedService?.provider_service_id] ??
    selectedService?.description;

  return desc ? (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-zinc-200">Deskripsi Layanan</div>
      <div className="text-sm text-zinc-300 whitespace-pre-line">{desc}</div>
    </div>
  ) : null;
})()}
</div>    
)}       


       
      </main>
{/* ====== SECTION: STATUS ORDER ====== */}
<section ref={statusRef} className="mt-12 rounded-2xl border border-white/10 p-6 bg-white/5">
  <h2 className="text-xl font-semibold mb-4">Status Order</h2>

  <div className="flex flex-col sm:flex-row gap-3">
    <input
      className="flex-1 p-3 rounded-xl border border-white/10 bg-white/10"
      placeholder="Masukkan nomor order (invoice/order_id)"
      value={statusOrderId}
      onChange={(e)=>setStatusOrderId(e.target.value)}
      onKeyDown={(e)=>{ if(e.key==='Enter') fetchOrderStatus(statusOrderId); }}
    />
    <button
      onClick={()=>fetchOrderStatus(statusOrderId)}
      className="px-4 py-3 rounded-xl text-white bg-gradient-to-r from-fuchsia-600 to-purple-600"
      disabled={statusLoading}
    >
      {statusLoading ? "Mengecek…" : "Cek Status"}
    </button>
  </div>

  {/* Error */}
  {statusError && <div className="mt-3 text-sm text-red-400">{statusError}</div>}

  {/* Hasil */}
  {statusData && (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="text-sm text-zinc-300">
        <span className="font-semibold">Status:</span> {statusData.status || statusData.order_status || "-"}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-sm text-zinc-300">
        <div><span className="font-semibold">Order ID:</span> {statusData.order_id || statusData.id || "-"}</div>
        <div><span className="font-semibold">Provider Order:</span> {statusData.provider_order_id || "-"}</div>
        <div><span className="font-semibold">Start Count:</span> {statusData.start_count ?? "-"}</div>
        <div><span className="font-semibold">Remains:</span> {statusData.remains ?? "-"}</div>
        <div><span className="font-semibold">Charge:</span> {statusData.charge != null ? `Rp ${statusData.charge}` : "-"}</div>
        <div><span className="font-semibold">Created:</span> {statusData.created_at || statusData.created || "-"}</div>
      </div>

      {/* Tombol refresh cepat */}
      <div className="pt-2">
        <button
          onClick={()=>fetchOrderStatus(statusOrderId)}
          className="text-xs px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10"
          disabled={statusLoading}
        >
          Refresh Status
        </button>
      </div>
    </div>
  )}
</section>


{/* ====== SECTION: MONITORING SOSMED ====== */}
<section ref={monitoringRef} className="mt-6 rounded-2xl border border-white/10 p-6 bg-white/5">
  <h2 className="text-xl font-semibold mb-2">Monitoring Sosmed</h2>
  <p className="text-sm text-zinc-300">Pantau progres layanan (coming soon).</p>
</section>

{/* ====== SECTION: DAFTAR HARGA ====== */}
<section ref={priceRef} className="mt-6 rounded-2xl border border-white/10 p-6 bg-white/5">
  <h2 className="text-xl font-semibold mb-2">Daftar Harga</h2>
  <p className="text-sm text-zinc-300">Tabel harga layanan terbaru (coming soon). Kamu bisa render dari data `services` yang sudah dimuat.</p>
</section>

      <footer className="py-10 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Aurum Panel — crafted with care
      </footer>
    </div>
  );
}
