/**
 * Middleware factory functions.
 * Each returns a standard (req, res, next) function.
 *
 * authenticate  — Verifies JWT in Authorization header, attaches req.user
 * requireRole   — Guards a route to specific roles
 * requireActive — Rejects inactive accounts
 */

const { verify } = require("../utils/auth");
const { unauthorized, forbidden } = require("../utils/response");
const store = require("../db/store");

// ─── Body parser ──────────────────────────────────────────────────────────────

/**
 * Reads the request body and parses it as JSON.
 * Attaches the result to req.body. Non-JSON or empty bodies become {}.
 */
function parseBody(req, res, next) {
  let raw = "";
  req.on("data", chunk => (raw += chunk));
  req.on("end", () => {
    if (!raw) { req.body = {}; return next(); }
    try {
      req.body = JSON.parse(raw);
      next();
    } catch {
      const { badRequest } = require("../utils/response");
      badRequest(res, "Request body must be valid JSON");
    }
  });
}

// ─── Query string parser ──────────────────────────────────────────────────────

function parseQuery(req, _res, next) {
  const url  = new URL(req.url, "http://localhost");
  req.query  = Object.fromEntries(url.searchParams.entries());
  req.path   = url.pathname;
  next();
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res);
  }
  const token = authHeader.slice(7);
  try {
    const payload = verify(token);
    // Re-fetch user to catch status changes after token issuance
    const user = store.getUser(payload.sub);
    if (!user) return unauthorized(res, "User no longer exists");
    if (user.status === "inactive") return forbidden(res, "Account is inactive");
    req.user = user;
    next();
  } catch (err) {
    unauthorized(res, err.message);
  }
}

// ─── RBAC middleware ──────────────────────────────────────────────────────────

const ROLE_HIERARCHY = { viewer: 1, analyst: 2, admin: 3 };

/**
 * requireRole("analyst") — passes if req.user.role is analyst OR admin.
 * requireRole("admin")   — only admins pass.
 */
function requireRole(...roles) {
  const minLevel = Math.min(...roles.map(r => ROLE_HIERARCHY[r] ?? 99));
  return (req, res, next) => {
    const userLevel = ROLE_HIERARCHY[req.user?.role] ?? 0;
    if (userLevel < minLevel) {
      return forbidden(res, `Requires role: ${roles.join(" or ")}`);
    }
    next();
  };
}

// Convenience shorthands
const requireAdmin   = requireRole("admin");
const requireAnalyst = requireRole("analyst"); // analyst or admin
const requireViewer  = requireRole("viewer");  // any authenticated user

module.exports = { parseBody, parseQuery, authenticate, requireRole, requireAdmin, requireAnalyst, requireViewer };
