const DEFAULT_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || "*";

function applyCors(req, res) {
  const origin = DEFAULT_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (origin !== "*") res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

module.exports = applyCors;
