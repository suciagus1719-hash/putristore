import { useEffect, useState } from "react";

export default function PlatformSection() {
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const API = import.meta.env.VITE_API_URL;

    async function load() {
      try {
        const res = await fetch(`${API}/api/platforms`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPlatforms(data);
      } catch (e) {
        setError(String(e.message || e));
        console.error("Gagal memuat layanan:", e);
      }
    }

    load();
  }, []);

  if (error) return <p style={{color:"red"}}>Gagal memuat: {error}</p>;

  return (
    <section>
      <h2>Layanan Kami</h2>
      <ul>
        {platforms.length
          ? platforms.map(p => <li key={p.id}>{p.name}</li>)
          : <li>Sedang memuat…</li>}
      </ul>
    </section>
  );
}
