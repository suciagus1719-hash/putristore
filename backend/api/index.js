// api/index.js
// Express app dibungkus secara manual (app(req,res))
const express = require("express");
const paymentFlow = require("../routes/order/paymentFlow");
const applyCors = require("../routes/order/cors");

const app = express();

// CORS global supaya request preflight selalu berhasil
app.use((req, res, next) => {
  if (applyCors(req, res)) return;
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
