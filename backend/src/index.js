require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { ready } = require("./db");
const ideasRouter = require("./routes/ideas");
const draftsRouter = require("./routes/drafts");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// /api/ideas mixes Apps-Script-only routes and dashboard-only routes, so
// the service-key check is applied per-route inside routes/ideas.js instead
// of here.
app.use("/api/ideas", ideasRouter);
app.use("/api/drafts", draftsRouter);

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
