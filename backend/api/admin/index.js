const express = require("express");
const applyCors = require("../../routes/order/cors");
const paymentFlow = require("../../routes/order/paymentFlow");

const app = express();
app.use((req, res, next) => {
  if (applyCors(req, res)) return;
  next();
});
app.use(express.json({ limit: "200kb" }));
app.use(paymentFlow);

module.exports = (req, res) => {
  req.url = req.url.replace(/^\/api/, "") || "/";
  return app(req, res);
};
