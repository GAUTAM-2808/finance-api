/**
 * Lightweight validation library (no deps).
 * Returns { errors: string[] } — empty array means valid.
 */

function isEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isDate(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
}

const ROLES   = ["viewer", "analyst", "admin"];
const TYPES   = ["income", "expense"];
const STATUSES = ["active", "inactive"];

// ─── User validators ──────────────────────────────────────────────────────────

function validateCreateUser(body) {
  const errors = [];
  if (!body.name   || typeof body.name !== "string" || body.name.trim().length < 2)
    errors.push("name: required, at least 2 characters");
  if (!body.email  || !isEmail(body.email))
    errors.push("email: must be a valid email address");
  if (!body.password || body.password.length < 6)
    errors.push("password: required, at least 6 characters");
  if (body.role && !ROLES.includes(body.role))
    errors.push(`role: must be one of ${ROLES.join(", ")}`);
  return errors;
}

function validateUpdateUser(body) {
  const errors = [];
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length < 2))
    errors.push("name: must be at least 2 characters");
  if (body.email !== undefined && !isEmail(body.email))
    errors.push("email: must be a valid email address");
  if (body.password !== undefined && body.password.length < 6)
    errors.push("password: must be at least 6 characters");
  if (body.role !== undefined && !ROLES.includes(body.role))
    errors.push(`role: must be one of ${ROLES.join(", ")}`);
  if (body.status !== undefined && !STATUSES.includes(body.status))
    errors.push(`status: must be one of ${STATUSES.join(", ")}`);
  return errors;
}

// ─── Record validators ────────────────────────────────────────────────────────

function validateCreateRecord(body) {
  const errors = [];
  if (body.amount === undefined || isNaN(Number(body.amount)) || Number(body.amount) <= 0)
    errors.push("amount: required, must be a positive number");
  if (!body.type || !TYPES.includes(body.type))
    errors.push(`type: required, must be one of ${TYPES.join(", ")}`);
  if (!body.category || typeof body.category !== "string" || body.category.trim().length < 1)
    errors.push("category: required");
  if (!body.date || !isDate(body.date))
    errors.push("date: required, must be in YYYY-MM-DD format");
  return errors;
}

function validateUpdateRecord(body) {
  const errors = [];
  if (body.amount !== undefined && (isNaN(Number(body.amount)) || Number(body.amount) <= 0))
    errors.push("amount: must be a positive number");
  if (body.type !== undefined && !TYPES.includes(body.type))
    errors.push(`type: must be one of ${TYPES.join(", ")}`);
  if (body.date !== undefined && !isDate(body.date))
    errors.push("date: must be in YYYY-MM-DD format");
  return errors;
}

// ─── Auth validators ──────────────────────────────────────────────────────────

function validateLogin(body) {
  const errors = [];
  if (!body.email    || !isEmail(body.email))    errors.push("email: required");
  if (!body.password || body.password.length < 1) errors.push("password: required");
  return errors;
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateCreateRecord,
  validateUpdateRecord,
  validateLogin,
};
