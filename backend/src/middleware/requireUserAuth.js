// JWT-based auth for dashboard-facing, human-user routes. Separate from
// requireServiceKey (the x-service-key check for Apps Script's
// server-to-server calls) - the two protect different route sets and are
// never both applied to the same route.
async function requireUserAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No authorization token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const { verifyToken } = require("../services/auth");
    const decoded = verifyToken(token);
    req.user = decoded; // { userId, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireUserAuth };
