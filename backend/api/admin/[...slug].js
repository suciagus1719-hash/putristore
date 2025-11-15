const handler = require("./index");

function sendCorsOptions(res) {
  const origin = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, X-Admin-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
}

const wrapped = (req, res) => {
  if (req.method === "OPTIONS") {
    return sendCorsOptions(res);
  }
  return handler(req, res);
};

module.exports = wrapped;
module.exports.handler = wrapped;
