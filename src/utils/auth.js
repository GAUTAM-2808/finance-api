/**
 * Auth utilities using only Node.js built-in `crypto`.
 *
 * Assumptions:
 * - Passwords are hashed with PBKDF2 (SHA-256, 100k iterations) — a standard
 *   key-derivation function safe for production use.
 * - JWTs are implemented manually (HMAC-SHA256 signature) to avoid dependencies.
 *   In production you would use the `jsonwebtoken` package instead.
 */

const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-please";
const JWT_EXPIRY_SECONDS = 60 * 60 * 8; // 8 hours

// ─── Password ─────────────────────────────────────────────────────────────────

/**
 * Hash a plaintext password.
 * Returns "pbkdf2:<salt>:<hash>" as a storable string.
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(plain, salt, 100_000, 32, "sha256").toString("hex");
  return `pbkdf2:${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 */
function verifyPassword(plain, stored) {
  const [, salt, hash] = stored.split(":");
  const attempt = crypto.pbkdf2Sync(plain, salt, 100_000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(hash));
}

// ─── JWT (minimal, dependency-free) ──────────────────────────────────────────

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body   = b64url(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS })));
  const sig    = b64url(crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const [header, body, sig] = parts;
  const expectedSig = b64url(crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest());

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(b64urlDecode(body).toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return payload;
}

module.exports = { hashPassword, verifyPassword, sign, verify };
