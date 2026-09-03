require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { ready } = require("./db");
const ideasRouter = require("./routes/ideas");
const draftsRouter = require("./routes/drafts");
const authRouter = require("./routes/auth");
const { requireUserAuth } = require("./middleware/requireUserAuth");

const app = express();
// Explicit allowedHeaders so the frontend's Authorization: Bearer <jwt>
// header is never dropped in a cross-origin preflight, regardless of
// deployment origin (Vercel frontend, Render/Cloud Run backend).
app.use(cors({ origin: true, allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);

// /api/ideas mixes Apps-Script-only routes (protected by requireServiceKey)
// and dashboard-only routes (protected by requireUserAuth) - both checks
// are applied per-route inside routes/ideas.js instead of here, since a
// single mount-level middleware can't distinguish between them.
app.use("/api/ideas", ideasRouter);
// /api/drafts is entirely dashboard-facing (list/get/edit/approve/reject),
// never called by Apps Script directly, so it's safe to protect as a whole
// at the mount level.
app.use("/api/drafts", requireUserAuth, draftsRouter);

// Serve the built React frontend in production (after `npm run build` in /frontend)
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next();
  });
});

// Catches anything forwarded via next(err) - e.g. a transient DB/network
// error from an asyncHandler-wrapped route. Must be defined last, with all
// four params, for Express to treat it as an error-handling middleware.
// Returns a clean error response to that one request instead of letting a
// rejected promise crash the whole process.
app.use((err, req, res, next) => {
  console.error("Unhandled request error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;

async function main() {
  try {
    await ready; // don't accept requests until tables exist
  } catch (err) {
    console.error("Database initialization failed, server not starting:", err.message || err);
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
