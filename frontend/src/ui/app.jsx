import LuxuryOrderFlow from "../LuxuryOrderFlow.jsx"; // naik 1 folder dari /ui ke /src

export default function App() {
  return (
    <LuxuryOrderFlow
      apiBase={import.meta.env.VITE_API_BASE || "http://localhost:3001"}
    />
  );
}
