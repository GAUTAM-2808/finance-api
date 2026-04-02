/**
 * Finance API — server entry point.
 *
 * Architecture:
 *   Node.js http module  (no framework dependency)
 *   In-memory store + JSON file persistence
 *   JWT authentication (HMAC-SHA256, built-in crypto)
 *   Role-based access control (viewer → analyst → admin)
 */

const http = require("http");
const { parseQuery } = require("./middleware");
const { notFound, internalError } = require("./utils/response");

// ─── Routers ──────────────────────────────────────────────────────────────────
const authRouter      = require("./routes/auth");
const usersRouter     = require("./routes/users");
const recordsRouter   = require("./routes/records");
const dashboardRouter = require("./routes/dashboard");

const PORT = process.env.PORT || 3000;

// ─── Request handler ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS (helpful for local frontend dev)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Parse query string + clean up the path
  parseQuery(req, res, () => {});

  // Strip /api prefix if present (convenience)
  if (req.path.startsWith("/api")) {
    req.path = req.path.slice(4) || "/";
  }

  // ── Route dispatch ─────────────────────────────────────────────────────────
  try {
    if (authRouter.handle(req, res))      return;
    if (usersRouter.handle(req, res))     return;
    if (recordsRouter.handle(req, res))   return;
    if (dashboardRouter.handle(req, res)) return;

    // Health check
    if (req.path === "/" || req.path === "/health") {
      const { ok } = require("./utils/response");
      return ok(res, { status: "ok", version: "1.0.0" });
    }

    notFound(res, `Route not found: ${req.method} ${req.path}`);
  } catch (err) {
    console.error("[Unhandled error]", err);
    internalError(res);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Finance API running on http://localhost:${PORT}`);
  console.log("   Run  npm run seed  to populate demo data");
  console.log("   Run  npm test      to run the test suite\n");
});

module.exports = server; // for tests
