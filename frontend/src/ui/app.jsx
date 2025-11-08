import LuxuryOrderFlow from "../LuxuryOrderFlow.jsx";

export default function App() {
  return (
    <LuxuryOrderFlow
      apiBase={import.meta.env.VITE_API_URL || "https://putristore-backend.vercel.app"}
    />
  );
}
