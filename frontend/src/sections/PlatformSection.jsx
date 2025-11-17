import { useEffect, useState } from "react";
import { buildApiUrl } from "../config.js";

export default function PlatformSection() {
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(buildApiUrl("/api/platforms"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const normalized = (Array.isArray(data) ? data : []).map((item, idx) => {
          if (typeof item === "string") {
            return { id: `${idx}-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: item };
          }
          const name = item?.name || item?.label || String(item || "");
          return {
            id: item?.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `${idx}`,
            name,
          };
        });
        setPlatforms(normalized);
      } catch (e) {
        setError(String(e.message || e));
        console.error("Gagal memuat layanan:", e);
      }
    }

    load();
  }, []);

  if (error) return <p style={{ color: "red" }}>Gagal memuat: {error}</p>;

  return (
    <section>
      <h2>Layanan Kami</h2>
      <ul>
        {platforms.length ? (
          platforms.map((p) => <li key={p.id || p.name || p}>{p.name || p.label || p}</li>)
        ) : (
          <li>Sedang memuat...</li>
        )}
      </ul>
    </section>
  );
}
