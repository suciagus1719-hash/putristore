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
        setPlatforms(Array.isArray(data) ? data : []);
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
          platforms.map((p) => <li key={p.id || p.name}>{p.name}</li>)
        ) : (
          <li>Sedang memuat...</li>
        )}
      </ul>
    </section>
  );
}
