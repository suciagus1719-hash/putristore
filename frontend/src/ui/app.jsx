import LuxuryOrderFlow from "../LuxuryOrderFlow";


export default function App() {
  return (
    <LuxuryOrderFlow apiBase={import.meta.env.VITE_API_BASE || "http://localhost:3001"} />
  );
}
