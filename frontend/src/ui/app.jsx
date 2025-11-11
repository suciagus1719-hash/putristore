import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LuxuryOrderFlow from "../LuxuryOrderFlow.jsx";
import PaymentFlow from "../PaymentFlow.jsx";
import AdminPanel from "../AdminPanel.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "https://putristore-backend.vercel.app";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Halaman utama lama */}
        <Route path="/" element={<LuxuryOrderFlow apiBase={API_BASE} />} />

        {/* Flow baru: order → bayar → upload bukti */}
        <Route path="/payment" element={<PaymentFlow />} />

        {/* Panel admin (butuh password, di-handle di komponennya) */}
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
