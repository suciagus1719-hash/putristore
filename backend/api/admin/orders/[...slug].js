const handler = require("../../index");

module.exports = (req, res) => {
  req.url = req.url.replace(/^\/api\/admin\/orders/, "/admin/orders") || "/";
  return handler(req, res);
};
module.exports.handler = module.exports;
