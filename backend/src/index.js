require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const ideasRouter = require("./routes/ideas");
const draftsRouter = require("./routes/drafts");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Shared-secret auth for anything Apps Script calls (POST /api/ideas etc).
// The dashboard's own frontend calls /api/drafts/* without this header,
// so we only enforce it on the ideas intake routes.
function requireServiceKey(req, res, next) {
  if (req.headers["x-service-key"] !== process.env.NODE_APP_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/ideas", requireServiceKey, ideasRouter);
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
