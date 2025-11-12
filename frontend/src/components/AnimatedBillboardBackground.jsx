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

const BILLBOARD_IMAGES = sanitizeList([...ENV_IMAGES, ...FALLBACK_IMAGES]).map(resolvePath);

export default function AnimatedBillboardBackground({ children }) {
  const [index, setIndex] = useState(0);
  const images = useMemo(() => (BILLBOARD_IMAGES.length ? BILLBOARD_IMAGES : FALLBACK_IMAGES), []);
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!hasMultiple) return undefined;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => clearInterval(id);
  }, [hasMultiple, images.length]);

  const current = images[index] || null;

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-gradient-to-b from-[#2b0f52] via-[#3f1380] to-[#18083b]">
      {current && (
        <div
          className={`absolute inset-0 ${hasMultiple ? "animate-pan" : ""}`}
          style={{
            backgroundImage: `url(${current})`,
            backgroundSize: "cover",
            backgroundRepeat: "repeat-x",
            backgroundPosition: "center",
            transition: "background-image 0.8s ease",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2b0f52]/60 via-[#41148c]/55 to-[#1a0936]/70" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
