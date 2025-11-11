// frontend/src/ui/app.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import LuxuryOrderFlow from "../LuxuryOrderFlow.jsx";
import PaymentFlow from "../PaymentFlow.jsx";
import AdminPanel from "../AdminPanel.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "https://putristore-backend.vercel.app";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LuxuryOrderFlow apiBase={API_BASE} />} />
      <Route path="/payment" element={<PaymentFlow />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>

  );
}
