const express = require("express");
const crypto = require("crypto");
const { db } = require("../db");
const {
  ALLOWED_DOMAINS,
  isAllowedDomain,
  hashPassword,
  comparePassword,
  generateToken,
  generateResetToken,
} = require("../services/auth");
const { sendPasswordResetEmail } = require("../services/email");
const { requireUserAuth } = require("../middleware/requireUserAuth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

function isReasonableEmail(email) {
  if (!email || typeof email !== "string") return false;
  const parts = email.split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[1].includes(".");
}

// POST /api/auth/signup
router.post("/signup", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isReasonableEmail(email)) {
    return res.status(400).json({ ok: false, error: "Please provide a valid email address" });
  }

  if (!isAllowedDomain(email)) {
    return res.status(403).json({
      ok: false,
      error: `Signup is restricted to these email domains: ${ALLOWED_DOMAINS.join(", ")}`,
    });
  }

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE lower(email) = lower(?)",
    args: [email],
  });
  if (existing.rows.length > 0) {
    return res.status(409).json({ ok: false, error: "An account with this email already exists" });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.execute({
    sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
    args: [id, email, passwordHash],
  });

  const token = generateToken(id, email);
  res.json({ ok: true, token, email });
}));

// POST /api/auth/login
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE lower(email) = lower(?)",
    args: [email || ""],
  });
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ ok: false, error: "Invalid email or password" });
  }

  const matches = await comparePassword(password || "", user.password_hash);
  if (!matches) {
    return res.status(401).json({ ok: false, error: "Invalid email or password" });
  }

  const token = generateToken(user.id, user.email);
  res.json({ ok: true, token, email: user.email });
}));

// POST /api/auth/forgot-password
router.post("/forgot-password", asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE lower(email) = lower(?)",
    args: [email || ""],
  });
  const user = result.rows[0];

  if (user) {
    const resetToken = generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    await db.execute({
      sql: "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      args: [resetToken, expires, user.id],
    });

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (err) {
      console.error("Failed to send password reset email:", err.message || err);
      // Don't leak email delivery failures to the client - fall through
      // to the same generic response either way.
    }
  }

  // Same response whether or not the email exists, so we never reveal
  // which emails are registered.
  res.json({ ok: true, message: "If an account exists for this email, a reset link has been sent" });
}));

// POST /api/auth/reset-password
router.post("/reset-password", asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?",
    args: [token || "", new Date().toISOString()],
  });
  const user = result.rows[0];

  if (!user) {
    return res.status(400).json({ ok: false, error: "Invalid or expired reset link" });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
  }

  const passwordHash = await hashPassword(newPassword);

  await db.execute({
    sql: "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
    args: [passwordHash, user.id],
  });

  res.json({ ok: true });
}));

// GET /api/auth/me  (protected - lets the frontend verify a stored token on load)
router.get("/me", requireUserAuth, (req, res) => {
  res.json({ email: req.user.email });
});

module.exports = router;
