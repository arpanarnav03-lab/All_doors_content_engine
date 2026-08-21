require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
