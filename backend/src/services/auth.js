const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ALLOWED_DOMAINS = [
  "alldoors.in",
  "truestate.in",
  "iqol.in",
  "vaultproptech.com",
  "acnonline.in",
];

function isAllowedDomain(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return false;
  const domain = email.split("@")[1];
  if (!domain) return false;
  return ALLOWED_DOMAINS.includes(domain.toLowerCase());
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  ALLOWED_DOMAINS,
  isAllowedDomain,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateResetToken,
};
