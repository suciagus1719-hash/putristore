const crypto = require("crypto");
const fetch = global.fetch || require("node-fetch");

const resolveTrimmed = (...candidates) =>
  candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";

const MERCHANT_CODE = resolveTrimmed(process.env.DUITKU_MERCHANT_CODE, process.env.DUITKU_MERCHANT);
const API_KEY = resolveTrimmed(process.env.DUITKU_API_KEY, process.env.DUITKU_SECRET);
const MODE = resolveTrimmed(process.env.DUITKU_ENV, process.env.DUITKU_MODE, process.env.DUITKU_STAGE, "sandbox").toLowerCase();
const isProduction = MODE === "production" || MODE === "prod" || MODE === "live";
const DEFAULT_BASE = isProduction ? "https://passport.duitku.com" : "https://sandbox.duitku.com";
const BASE_URL = (resolveTrimmed(process.env.DUITKU_BASE_URL) || DEFAULT_BASE).replace(/\/+$/, "");

const publicBaseCandidates = [
  resolveTrimmed(process.env.DUITKU_PUBLIC_BASE_URL),
  resolveTrimmed(process.env.BACKEND_PUBLIC_URL),
  resolveTrimmed(process.env.BACKEND_BASE_URL),
  resolveTrimmed(process.env.PUBLIC_BASE_URL),
  resolveTrimmed(process.env.APP_BASE_URL),
  resolveTrimmed(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : ""),
  resolveTrimmed(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
];

const PUBLIC_BASE_URL = publicBaseCandidates.find((value) => /^https?:\/\//i.test(value));
const CALLBACK_URL =
  resolveTrimmed(process.env.DUITKU_CALLBACK_URL) ||
  (PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL.replace(/\/+$/, "")}/api/order/duitku-callback` : "");
const RETURN_URL =
  resolveTrimmed(process.env.DUITKU_RETURN_URL, process.env.FRONTEND_URL, process.env.FRONTEND_ORIGIN) ||
  PUBLIC_BASE_URL ||
  "";
const EXPIRY_MINUTES = Math.max(Number(process.env.DUITKU_EXPIRY_MINUTES || 90), 5);

function isConfigured() {
  return Boolean(MERCHANT_CODE && API_KEY);
}

function computeInvoiceSignature(merchantOrderId, amount) {
  const paymentAmount = String(Math.round(Number(amount) || 0));
  const raw = `${MERCHANT_CODE}${merchantOrderId}${paymentAmount}${API_KEY}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

function computeCallbackSignature({ merchantCode, amount, merchantOrderId }) {
  const paymentAmount = String(amount || "");
  const raw = `${merchantCode}${paymentAmount}${merchantOrderId}${API_KEY}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

function verifyCallbackSignature(payload = {}) {
  if (!payload.merchantCode || !payload.merchantOrderId || !payload.signature) return false;
  const amount = payload.amount || payload.paymentAmount || payload.totalAmount || "";
  const expected = computeCallbackSignature({
    merchantCode: payload.merchantCode,
    amount,
    merchantOrderId: payload.merchantOrderId,
  });
  return expected === payload.signature;
}

function buildInvoicePayload(order, opts = {}) {
  if (!order?.order_id) throw new Error("Order tidak valid");
  if (!CALLBACK_URL) throw new Error("DUITKU_CALLBACK_URL belum dikonfigurasi");
  if (!RETURN_URL) throw new Error("DUITKU_RETURN_URL belum dikonfigurasi");
  const amountCandidate =
    opts.amount ??
    order.price?.total ??
    order.payment?.amount ??
    Number(order.total_price) ??
    Number(order.price_total);
  const paymentAmount = Math.round(Number(amountCandidate) || 0);
  if (!paymentAmount || paymentAmount <= 0) {
    throw new Error("Nominal order tidak valid");
  }
  const productDetails = String(
    opts.description || order.service_name || order.category || `Layanan ${order.service_id || ""}`
  ).trim();
  const fallbackName = order.customer?.name || "PutriStore Customer";
  const customerVaName = String(opts.customerVaName || fallbackName).trim().slice(0, 50) || "PutriStore Buyer";
  const email =
    order.customer?.email ||
    opts.email ||
    resolveTrimmed(process.env.DUITKU_FALLBACK_EMAIL, process.env.ADMIN_EMAIL) ||
    "customer@example.com";
  const phone =
    order.customer?.phone ||
    opts.phoneNumber ||
    resolveTrimmed(process.env.DUITKU_FALLBACK_PHONE, process.env.ADMIN_PHONE) ||
    "081234567890";

  const payload = {
    merchantCode: MERCHANT_CODE,
    paymentAmount: String(paymentAmount),
    merchantOrderId: order.order_id,
    productDetails: productDetails || `Order ${order.order_id}`,
    email,
    phoneNumber: phone,
    customerVaName,
    callbackUrl: CALLBACK_URL,
    returnUrl: RETURN_URL,
    expiryPeriod: Number.isFinite(opts.expiryMinutes) ? Math.max(Number(opts.expiryMinutes), 5) : EXPIRY_MINUTES,
    additionalParam: order.order_id,
    itemDetails: [
      {
        name: productDetails || "Layanan SMM",
        price: String(paymentAmount),
        quantity: 1,
      },
    ],
  };
  payload.signature = computeInvoiceSignature(payload.merchantOrderId, paymentAmount);
  return payload;
}

async function createHostedInvoice(order, opts = {}) {
  if (!isConfigured()) {
    return { ok: false, message: "DUITKU_MERCHANT_CODE/Duitku API key belum diset" };
  }
  const payload = buildInvoicePayload(order, opts);
  const endpoint = `${BASE_URL}/api/merchant/createInvoice`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!resp.ok || !json || json.statusCode !== "00" || !json.paymentUrl) {
    return {
      ok: false,
      message: json?.statusMessage || json?.Message || json?.message || "Gagal membuat pembayaran",
      detail: json || text,
      statusCode: json?.statusCode || resp.status,
    };
  }
  return {
    ok: true,
    payload,
    response: json,
  };
}

function getConfig() {
  return {
    isConfigured: isConfigured(),
    baseUrl: BASE_URL,
    callbackUrl: CALLBACK_URL,
    returnUrl: RETURN_URL,
    mode: isProduction ? "production" : "sandbox",
  };
}

module.exports = {
  isConfigured,
  getConfig,
  createHostedInvoice,
  verifyCallbackSignature,
};
