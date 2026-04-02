const Router = require("../router");
const store  = require("../db/store");
const { hashPassword } = require("../utils/auth");
const { validateCreateUser, validateUpdateUser } = require("../utils/validators");
const { ok, created, noContent, badRequest, notFound, conflict } = require("../utils/response");
const { parseBody, authenticate, requireAdmin } = require("../middleware");

const router = new Router();

/**
 * Strip the password hash before returning user data.
 */
function safeUser(u) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

// ─── GET /users ──────────────────────────────────────────────────────────────
// Admin only: list all users
router.get("/users", authenticate, requireAdmin, (req, res) => {
  const users = store.listUsers().map(safeUser);
  ok(res, { users, total: users.length });
});

// ─── GET /users/me ────────────────────────────────────────────────────────────
// Any authenticated user: get own profile
router.get("/users/me", authenticate, (req, res) => {
  ok(res, safeUser(req.user));
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────
// Admin only: get single user
router.get("/users/:id", authenticate, requireAdmin, (req, res) => {
  const user = store.getUser(req.params.id);
  if (!user) return notFound(res, "User not found");
  ok(res, safeUser(user));
});

// ─── POST /users ──────────────────────────────────────────────────────────────
// Admin only: create a user
router.post("/users", authenticate, requireAdmin, parseBody, (req, res) => {
  const errors = validateCreateUser(req.body);
  if (errors.length) return badRequest(res, "Validation failed", errors);

  try {
    const user = store.createUser({
      name:         req.body.name.trim(),
      email:        req.body.email.toLowerCase().trim(),
      passwordHash: hashPassword(req.body.password),
      role:         req.body.role ?? "viewer",
      status:       req.body.status ?? "active",
    });
    created(res, safeUser(user));
  } catch (err) {
    if (err.status === 409) return conflict(res, err.message);
    throw err;
  }
});

// ─── PATCH /users/:id ─────────────────────────────────────────────────────────
// Admin only: update a user  (or own profile for non-admins, limited fields)
router.patch("/users/:id", authenticate, parseBody, (req, res) => {
  const isAdmin = req.user.role === "admin";
  const isSelf  = req.user.id === req.params.id;

  if (!isAdmin && !isSelf) {
    const { forbidden } = require("../utils/response");
    return forbidden(res);
  }

  // Non-admins cannot change role or status
  if (!isAdmin) {
    delete req.body.role;
    delete req.body.status;
  }

  const errors = validateUpdateUser(req.body);
  if (errors.length) return badRequest(res, "Validation failed", errors);

  const updates = {};
  if (req.body.name)     updates.name     = req.body.name.trim();
  if (req.body.email)    updates.email    = req.body.email.toLowerCase().trim();
  if (req.body.password) updates.passwordHash = hashPassword(req.body.password);
  if (req.body.role)     updates.role     = req.body.role;
  if (req.body.status)   updates.status   = req.body.status;

  try {
    const user = store.updateUser(req.params.id, updates);
    ok(res, safeUser(user));
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status === 409) return conflict(res, err.message);
    throw err;
  }
});

// ─── DELETE /users/:id ────────────────────────────────────────────────────────
// Admin only: hard-delete a user (cannot delete self)
router.delete("/users/:id", authenticate, requireAdmin, (req, res) => {
  if (req.user.id === req.params.id) {
    return badRequest(res, "You cannot delete your own account");
  }
  try {
    store.deleteUser(req.params.id);
    noContent(res);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    throw err;
  }
});

module.exports = router;
