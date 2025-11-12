const { processCheckout } = require("./checkoutLogic");

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function checkoutHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = await readBody(req);
  const result = await processCheckout(body);
  return res.status(result.statusCode).json(result.body);
}

module.exports = checkoutHandler;
module.exports.handler = checkoutHandler;
