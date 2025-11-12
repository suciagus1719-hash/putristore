import { useEffect, useMemo, useState } from "react";

const BASE_URL = (import.meta.env?.BASE_URL || import.meta.env?.VITE_BASE_URL || "/").replace(/\/+$/, "/");
const resolvePath = (path) => {
  const clean = String(path || "").trim();
  if (!clean) return "";
  if (/^(https?:)?\/\//i.test(clean) || clean.startsWith("data:")) return clean;
  const normalized = clean.replace(/^\/+/, "");
  return `${BASE_URL}${normalized}`;
};

const FALLBACK_IMAGES = [
  "assets/billboard/billboard-1.jpg",
  "assets/billboard/billboard-1.jpeg",
  "assets/billboard/billboard-2.jpg",
  "assets/billboard/billboard-2.jpeg",
  "assets/billboard/billboard-3.jpg",
  "assets/billboard/billboard-3.jpeg",
  "assets/billboard/billboard-4.jpg",
  "assets/billboard/billboard-4.jpeg",
  "assets/billboard/billboard-5.jpg",
  "assets/billboard/billboard-5.jpeg",
];

const sanitizeList = (list = []) =>
  list
    .map((src) => String(src || "").trim())
    .filter((src, idx, arr) => src && arr.indexOf(src) === idx);

const ENV_IMAGES = sanitizeList(
  (import.meta.env?.VITE_BILLBOARD_IMAGES || "")
    .split(",")
    .map((src) => src.replace(/^['"]|['"]$/g, ""))
);

const IMAGE_POOL = sanitizeList([...ENV_IMAGES, ...FALLBACK_IMAGES])
  .map(resolvePath)
  .filter(Boolean);

const DISPLAY_IMAGES = IMAGE_POOL.length ? IMAGE_POOL : FALLBACK_IMAGES.map(resolvePath);

export default function BillboardBanner() {
  const [index, setIndex] = useState(0);
  const images = useMemo(() => DISPLAY_IMAGES, []);
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!hasMultiple) return undefined;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(id);
  }, [hasMultiple, images.length]);

  const current = images[index] || null;

  if (!current) return null;

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-lg">
      <div className="relative h-40 sm:h-48">
        <img
          src={current}
          alt="Billboard promo"
          className={`h-full w-full object-cover ${hasMultiple ? "animate-pan" : ""}`}
        />
        {hasMultiple && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/15 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
