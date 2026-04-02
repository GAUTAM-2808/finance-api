const Router = require("../router");
const store  = require("../db/store");
const { ok } = require("../utils/response");
const { authenticate, requireAnalyst } = require("../middleware");

const router = new Router();

/**
 * GET /dashboard/summary
 * Role: analyst, admin
 *
 * Returns:
 *   totalIncome    — sum of all income records
 *   totalExpenses  — sum of all expense records
 *   netBalance     — totalIncome - totalExpenses
 *   byCategory     — { [category]: totalAmount }
 *   byMonth        — { [YYYY-MM]: { income, expense } }
 *   recent         — last 10 records (newest first)
 *
 * Query params (optional):
 *   dateFrom  — YYYY-MM-DD
 *   dateTo    — YYYY-MM-DD
 */
router.get("/dashboard/summary", authenticate, requireAnalyst, (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const summary = store.getSummary({ dateFrom, dateTo });
  ok(res, summary);
});

/**
 * GET /dashboard/trends
 * Role: analyst, admin
 *
 * Derived view of monthly data in a chart-friendly array format.
 */
router.get("/dashboard/trends", authenticate, requireAnalyst, (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const { byMonth } = store.getSummary({ dateFrom, dateTo });

  const trends = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income:  data.income,
      expense: data.expense,
      net:     data.income - data.expense,
    }));

  ok(res, { trends });
});

/**
 * GET /dashboard/categories
 * Role: analyst, admin
 *
 * Category breakdown with percentage share.
 */
router.get("/dashboard/categories", authenticate, requireAnalyst, (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const { byCategory, totalIncome, totalExpenses } = store.getSummary({ dateFrom, dateTo });
  const total = totalIncome + totalExpenses;

  const categories = Object.entries(byCategory).map(([name, amount]) => ({
    name,
    amount,
    percentage: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0,
  }));

  categories.sort((a, b) => b.amount - a.amount);
  ok(res, { categories });
});

module.exports = router;
