// ganti baris import di src/LuxuryOrderFlow.jsx


// src/utils/orderMeta.js
export function saveOrderMeta(meta) {
  try {
    if (!meta?.order_id) return;
    localStorage.setItem(`order:${meta.order_id}`, JSON.stringify(meta));
  } catch {}
}

export function getOrderMeta(orderId) {
  try {
    const raw = localStorage.getItem(`order:${orderId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
