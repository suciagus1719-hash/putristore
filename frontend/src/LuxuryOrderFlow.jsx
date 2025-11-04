import React, { useEffect, useMemo, useState } from "react";
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

/* Map platform -> icon component */
const PLATFORM_ICONS = {
  Instagram, YouTube: Youtube, Facebook, LinkedIn: Linkedin,
  Twitter, "Twitter/X": Twitter, TikTok: TikTokIcon, Telegram: TelegramIcon, Other: Sparkles,
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

  // 5) preview harga
  useEffect(()=>{
    if(!selectedService || !quantity){ setPreview(null); return; }
    const controller = new AbortController();
    (async()=>{
      try{
        const r = await fetch(`${apiBase}/api/order/preview`, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ provider_service_id:selectedService.provider_service_id, quantity }),
          signal:controller.signal
        });
        const j = await r.json(); setPreview(j?.price??null);
      }catch{}
    })();
    return ()=>controller.abort();
  },[selectedService, quantity, apiBase]);

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

  /* ---- UI helpers ---- */
  const GradientBg = () => (
    <div className="absolute inset-0 -z-10">
      <div className="absolute -top-20 -left-32 h-72 w-72 rounded-full bg-fuchsia-500/30 blur-3xl"/>
      <div className="absolute top-48 -right-24 h-80 w-80 rounded-full bg-purple-600/25 blur-3xl"/>
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl"/>
    </div>
  );

  const Header = () => (
    <div className="sticky top-0 z-30 backdrop-blur bg-zinc-950/60 border-b border-white/10">
      <div className="max-w-6xl mx-auto p-3 flex items-center gap-3">
        {invoice && (
          <button onClick={()=>setInvoice(null)} className="p-2 rounded-xl border border-white/10 hover:bg-white/5">
            <ChevronLeft className="h-5 w-5"/>
          </button>
        )}
        <Sparkles className="h-5 w-5 text-fuchsia-400"/>
        <span className="font-semibold">Putri Gmoyy Store</span>
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
    <div className="min-h-[100svh] relative bg-gradient-to-b from-zinc-950 to-black text-zinc-50">
      <GradientBg/>
      <Header/>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* HEADLINE */}
        <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="mb-8 text-center">
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
            const Icon = PLATFORM_ICONS[name] || Sparkles;
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

        {/* KATEGORI */}
        {!!platform && (
          <div className="mt-6">
            <div className="text-sm mb-1">Kategori *</div>
            <select
              className="w-full p-3 rounded-xl border border-white/10 bg-white/10"
              value={action}
              onChange={(e)=>setAction(e.target.value)}
            >
              <option value="">Pilih Salah Satu</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
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

            {/* Deskripsi layanan dipindah ke bawah tombol */}
            {selectedService?.description && (
              <div className="text-sm text-zinc-300">{selectedService.description}</div>
            )}
            {error && <div className="text-sm text-red-400">{error}</div>}
          </div>
        )}

        {/* Rekomendasi (opsional) */}
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {["Starter Pack","Growth Turbo","Ultra Fast"].map(tag=> (
            <div key={tag} className="rounded-2xl p-5 border border-white/10 bg-gradient-to-br from-white/5 to-indigo-500/[.06]">
              <div className="text-xs uppercase text-zinc-300">Rekomendasi</div>
              <div className="text-lg font-semibold mt-1">{tag}</div>
              <p className="text-sm text-zinc-300 mt-1">Kombinasi layanan paling laris untuk hasil cepat.</p>
              <button className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white"
                      onClick={()=>setPlatform(platforms[0])}>Pilih paket <ArrowRight className="h-4 w-4"/></button>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-10 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Aurum Panel — crafted with care
      </footer>
    </div>
  );
}
