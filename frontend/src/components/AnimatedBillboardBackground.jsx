import { useEffect, useMemo, useState } from "react";

const FALLBACK_IMAGES = [
  "/assets/billboard/billboard-1.jpg",
  "/assets/billboard/billboard-2.jpg",
  "/assets/billboard/billboard-3.jpg",
  "/assets/billboard/billboard-4.jpg",
  "/assets/billboard/billboard-5.jpg",
];

const sanitizeList = (list = []) =>
  list
    .map((src) => String(src || "").trim())
    .filter((src, idx, arr) => src && arr.indexOf(src) === idx);

const BILLBOARD_IMAGES = sanitizeList(FALLBACK_IMAGES);

export default function AnimatedBillboardBackground({ children }) {
  const [index, setIndex] = useState(0);
  const images = useMemo(() => BILLBOARD_IMAGES, []);
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!hasMultiple) return undefined;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => clearInterval(id);
  }, [hasMultiple, images.length]);

  const current = images[index];

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <div
        className={bsolute inset-0 }
        style={{
          backgroundImage: current ? url() : undefined,
          backgroundSize: "cover",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
          transition: "background-image 0.8s ease",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1d0b2d]/90 via-[#37106b]/92 to-[#090213]/95" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
