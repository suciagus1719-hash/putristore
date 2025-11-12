// api/index.js
// Express app dibungkus serverless secara manual (app(req,res))
const express = require("express");
const paymentFlow = require("../routes/order/paymentFlow");
const checkoutHandler = require("./order/checkout");
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://suciagus1719-hash.github.io";

const app = express();
// Pastikan CORS ditangani sebelum middleware lain agar preflight OPTIONS selalu sukses
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "200kb" }));

// Rute checkout khusus ditangani terlebih dahulu agar tidak tertabrak paymentFlow
const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res)).catch(next);
};
app.use("/api/order/checkout", wrapAsync(checkoutHandler));
app.use("/order/checkout", wrapAsync(checkoutHandler));

// Rute lain tetap dilayani oleh paymentFlow
app.use("/api", paymentFlow);

// Expose the app as handler untuk Vercel
const handler = (req, res) => app(req, res);
module.exports = handler;
module.exports.handler = handler;
module.exports.app = app;
