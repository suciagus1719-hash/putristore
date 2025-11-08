// backend/api/paymu_checkout.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, phone, amount } = req.body;
  const va = process.env.IPAYMU_VA;
  const apiKey = process.env.IPAYMU_API;
  const url = "https://my.ipaymu.com/api/v2/payment";

  const body = {
    product: ["Layanan SMM"],
    qty: [1],
    price: [amount],
    returnUrl: "https://suciagus1719-hash.github.io/putristore/",
    notifyUrl: "https://putristore-backend.vercel.app/api/paymu_webhook",
    buyerName: name || "Test Buyer",
    buyerEmail: email || "test@example.com",
    buyerPhone: phone || "08123456789"
  };

  const json = JSON.stringify(body);

  // Buat signature sesuai dokumen resmi iPaymu
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const signSource = `POST:${va}:${hashHex}:${apiKey}`;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signSource));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "va": va,
      "signature": signatureHex,
      "timestamp": new Date().toISOString()
    },
    body: json
  });

  const result = await r.json();
  if (result?.Data?.Url) {
    return res.status(200).json({ ok: true, checkout_url: result.Data.Url });
  } else {
    return res.status(400).json({ ok: false, result });
  }
}
