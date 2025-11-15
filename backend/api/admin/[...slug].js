const handler = require("./index");

module.exports = (req, res) => {
  req.url = req.url.replace(/^\/api/, "") || "/";
  return handler(req, res);
};
module.exports.handler = handler;
