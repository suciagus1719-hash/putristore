// api/index.js
// Express app dibungkus secara manual (app(req,res))
const express = require("express");
const paymentFlow = require("../routes/order/paymentFlow");
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";

const app = express();

// CORS global supaya request preflight selalu berhasil
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "200kb" }));

// Seluruh route order/payment ditangani oleh paymentFlow seperti semula
app.use("/api", paymentFlow);

// Vercel handler
const handler = (req, res) => app(req, res);
module.exports = handler;
module.exports.handler = handler;
module.exports.app = app;
