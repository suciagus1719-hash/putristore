// frontend/src/ui/app.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import LuxuryOrderFlow from "../LuxuryOrderFlow.jsx";
import PaymentFlow from "../PaymentFlow.jsx";
import { API_BASE } from "../config.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LuxuryOrderFlow apiBase={API_BASE} />} />
      <Route path="/payment" element={<PaymentFlow />} />
    </Routes>

  );
}
