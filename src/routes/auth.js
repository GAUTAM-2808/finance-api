const Router = require("../router");
const store  = require("../db/store");
const { verifyPassword, sign } = require("../utils/auth");
const { validateLogin } = require("../utils/validators");
const { ok, badRequest, unauthorized } = require("../utils/response");
const { parseBody } = require("../middleware");

const router = new Router();

/**
 * POST /auth/login
 * Body: { email, password }
 *
 * Returns: { token, user }
 */
router.post("/auth/login", parseBody, (req, res) => {
  const errors = validateLogin(req.body);
  if (errors.length) return badRequest(res, "Validation failed", errors);

  const user = store.getUserByEmail(req.body.email);
  if (!user) return unauthorized(res, "Invalid email or password");
  if (user.status === "inactive") return unauthorized(res, "Account is inactive");

  let valid;
  try {
    valid = verifyPassword(req.body.password, user.passwordHash);
  } catch {
    valid = false;
  }
  if (!valid) return unauthorized(res, "Invalid email or password");

  const token = sign({ sub: user.id, role: user.role });
  const { passwordHash: _, ...safeUser } = user;

  ok(res, { token, user: safeUser });
});

module.exports = router;
