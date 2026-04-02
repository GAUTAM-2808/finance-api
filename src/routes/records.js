const Router = require("../router");
const store  = require("../db/store");
const { validateCreateRecord, validateUpdateRecord } = require("../utils/validators");
const { ok, created, noContent, badRequest, notFound } = require("../utils/response");
const { parseBody, authenticate, requireAdmin, requireAnalyst } = require("../middleware");

const router = new Router();

// ─── GET /records ─────────────────────────────────────────────────────────────
// All authenticated users: list records (with filters + pagination)
//
// Query params:
//   type      — income | expense
//   category  — string
//   dateFrom  — YYYY-MM-DD
//   dateTo    — YYYY-MM-DD
//   page      — default 1
//   limit     — default 20, max 100
router.get("/records", authenticate, (req, res) => {
  const { type, category, dateFrom, dateTo } = req.query;
  const page  = Math.max(1, parseInt(req.query.page  ?? "1",  10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20", 10)));

  const result = store.listRecords({ type, category, dateFrom, dateTo, page, limit });
  ok(res, result);
});

// ─── GET /records/:id ─────────────────────────────────────────────────────────
// All authenticated users: get single record
router.get("/records/:id", authenticate, (req, res) => {
  const record = store.getRecord(req.params.id);
  if (!record) return notFound(res, "Record not found");
  ok(res, record);
});

// ─── POST /records ────────────────────────────────────────────────────────────
// Admin only: create a record
router.post("/records", authenticate, requireAdmin, parseBody, (req, res) => {
  const errors = validateCreateRecord(req.body);
  if (errors.length) return badRequest(res, "Validation failed", errors);

  const record = store.createRecord({
    amount:    req.body.amount,
    type:      req.body.type,
    category:  req.body.category.trim(),
    date:      req.body.date,
    notes:     req.body.notes,
    createdBy: req.user.id,
  });
  created(res, record);
});

// ─── PATCH /records/:id ───────────────────────────────────────────────────────
// Admin only: update a record
router.patch("/records/:id", authenticate, requireAdmin, parseBody, (req, res) => {
  const errors = validateUpdateRecord(req.body);
  if (errors.length) return badRequest(res, "Validation failed", errors);

  try {
    const record = store.updateRecord(req.params.id, req.body);
    ok(res, record);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    throw err;
  }
});

// ─── DELETE /records/:id ──────────────────────────────────────────────────────
// Admin only: soft-delete a record
router.delete("/records/:id", authenticate, requireAdmin, (req, res) => {
  try {
    store.deleteRecord(req.params.id);
    noContent(res);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    throw err;
  }
});

module.exports = router;
