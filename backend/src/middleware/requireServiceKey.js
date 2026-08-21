// Shared-secret auth for anything Apps Script calls (POST /api/ideas etc).
// The dashboard's own frontend calls other routes without this header,
// so this is applied per-route, not at the router mount level.
function requireServiceKey(req, res, next) {
  if (req.headers["x-service-key"] !== process.env.NODE_APP_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

module.exports = requireServiceKey;
