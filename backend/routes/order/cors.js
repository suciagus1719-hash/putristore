const DEFAULT_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || "*";

const normalizeOrigins = (value) => {
  if (!value || value.trim() === "") return ["*"];
  if (value.trim() === "*") return ["*"];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const ALLOWED_ORIGINS = normalizeOrigins(DEFAULT_ORIGIN);
const ALLOW_ANY = ALLOWED_ORIGINS.includes("*");

function resolveOrigin(requestOrigin) {
  if (ALLOW_ANY) return "*";
  if (!requestOrigin) return ALLOWED_ORIGINS[0] || "*";
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0] || requestOrigin;
}

function applyCors(req, res) {
  const origin = resolveOrigin(req.headers.origin);
  res.setHeader("Access-Control-Allow-Origin", origin);
  // Izinkan PATCH agar admin bisa update status lewat metode selain POST
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  const requestedHeaders = req.headers["access-control-request-headers"];
  const allowHeaders =
    requestedHeaders && requestedHeaders.length
      ? requestedHeaders
      : "Content-Type, Accept, Authorization, X-Admin-Key, x-admin-key";
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);
  res.setHeader("Access-Control-Max-Age", "600");

  if (origin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

module.exports = applyCors;
