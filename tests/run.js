/**
 * Integration test suite — zero dependencies.
 * Tests real HTTP calls against the running server.
 *
 * Usage: node tests/run.js
 */

const http   = require("http");
const assert = require("assert");

// Delete any existing data to start fresh
const path = require("path");
const fs   = require("fs");
const DATA = path.join(__dirname, "../data.json");
if (fs.existsSync(DATA)) fs.unlinkSync(DATA);

const server = require("../src/server");

// ─── HTTP client helper ───────────────────────────────────────────────────────

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: 3000,
      path: urlPath,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
    failed++;
  }
}

// ─── Seed an admin for tests ──────────────────────────────────────────────────

async function setup() {
  const store = require("../src/db/store");
  const { hashPassword } = require("../src/utils/auth");
  store.createUser({ name: "Test Admin", email: "admin@test.com", passwordHash: hashPassword("testpass"), role: "admin" });
  store.createUser({ name: "Test Analyst", email: "analyst@test.com", passwordHash: hashPassword("testpass"), role: "analyst" });
  store.createUser({ name: "Test Viewer", email: "viewer@test.com", passwordHash: hashPassword("testpass"), role: "viewer" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  await new Promise(r => setTimeout(r, 50)); // let server start
  await setup();

  let adminToken, analystToken, viewerToken, newUserId, recordId;

  console.log("\nAuth");

  await test("POST /auth/login — admin login succeeds", async () => {
    const r = await request("POST", "/auth/login", { email: "admin@test.com", password: "testpass" });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.token);
    adminToken = r.body.data.token;
  });

  await test("POST /auth/login — analyst login succeeds", async () => {
    const r = await request("POST", "/auth/login", { email: "analyst@test.com", password: "testpass" });
    assert.equal(r.status, 200);
    analystToken = r.body.data.token;
  });

  await test("POST /auth/login — viewer login succeeds", async () => {
    const r = await request("POST", "/auth/login", { email: "viewer@test.com", password: "testpass" });
    assert.equal(r.status, 200);
    viewerToken = r.body.data.token;
  });

  await test("POST /auth/login — wrong password returns 401", async () => {
    const r = await request("POST", "/auth/login", { email: "admin@test.com", password: "wrong" });
    assert.equal(r.status, 401);
  });

  await test("POST /auth/login — bad body returns 400", async () => {
    const r = await request("POST", "/auth/login", { email: "not-an-email", password: "" });
    assert.equal(r.status, 400);
    assert.ok(Array.isArray(r.body.error.details));
  });

  console.log("\nUser management");

  await test("GET /users — admin can list users", async () => {
    const r = await request("GET", "/users", null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.users.length >= 3);
    assert.ok(!r.body.data.users[0].passwordHash, "passwordHash must not be exposed");
  });

  await test("GET /users — viewer gets 403", async () => {
    const r = await request("GET", "/users", null, { Authorization: `Bearer ${viewerToken}` });
    assert.equal(r.status, 403);
  });

  await test("GET /users — unauthenticated gets 401", async () => {
    const r = await request("GET", "/users");
    assert.equal(r.status, 401);
  });

  await test("POST /users — admin creates user", async () => {
    const r = await request("POST", "/users", { name: "Dave", email: "dave@test.com", password: "pass123", role: "viewer" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 201);
    newUserId = r.body.data.id;
  });

  await test("POST /users — duplicate email returns 409", async () => {
    const r = await request("POST", "/users", { name: "Dave2", email: "dave@test.com", password: "pass123" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 409);
  });

  await test("POST /users — invalid body returns 400 with details", async () => {
    const r = await request("POST", "/users", { name: "x", email: "bad", password: "123" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 400);
    assert.ok(r.body.error.details.length >= 2);
  });

  await test("PATCH /users/:id — admin updates user role", async () => {
    const r = await request("PATCH", `/users/${newUserId}`, { role: "analyst", status: "inactive" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.role, "analyst");
  });

  await test("DELETE /users/:id — admin deletes user", async () => {
    const r = await request("DELETE", `/users/${newUserId}`, null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 204);
  });

  await test("GET /users/me — returns own profile", async () => {
    const r = await request("GET", "/users/me", null, { Authorization: `Bearer ${analystToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.email, "analyst@test.com");
  });

  console.log("\nFinancial records");

  await test("POST /records — admin creates record", async () => {
    const r = await request("POST", "/records", { amount: 5000, type: "income", category: "Salary", date: "2025-03-01" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 201);
    recordId = r.body.data.id;
  });

  await test("POST /records — analyst cannot create (403)", async () => {
    const r = await request("POST", "/records", { amount: 100, type: "expense", category: "Food", date: "2025-03-02" }, { Authorization: `Bearer ${analystToken}` });
    assert.equal(r.status, 403);
  });

  await test("POST /records — invalid data returns 400", async () => {
    const r = await request("POST", "/records", { amount: -50, type: "bad", date: "not-a-date" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 400);
    assert.ok(r.body.error.details.length >= 3);
  });

  await test("GET /records — viewer can list", async () => {
    const r = await request("GET", "/records", null, { Authorization: `Bearer ${viewerToken}` });
    assert.equal(r.status, 200);
    assert.ok(typeof r.body.data.total === "number");
  });

  await test("GET /records?type=income — filter works", async () => {
    const r = await request("GET", "/records?type=income", null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.items.every(i => i.type === "income"));
  });

  await test("GET /records — pagination params respected", async () => {
    const r = await request("GET", "/records?page=1&limit=1", null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.items.length, 1);
    assert.equal(r.body.data.limit, 1);
  });

  await test("PATCH /records/:id — admin updates record", async () => {
    const r = await request("PATCH", `/records/${recordId}`, { amount: 9999, notes: "Updated" }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.amount, 9999);
  });

  await test("DELETE /records/:id — admin soft-deletes", async () => {
    const r = await request("DELETE", `/records/${recordId}`, null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 204);
  });

  await test("GET /records/:id — deleted record returns 404", async () => {
    const r = await request("GET", `/records/${recordId}`, null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 404);
  });

  console.log("\nDashboard");

  // Seed some records first
  const store = require("../src/db/store");
  const adminUser = store.getUserByEmail("admin@test.com");
  store.createRecord({ amount: 10000, type: "income",  category: "Salary", date: "2025-01-10", createdBy: adminUser.id });
  store.createRecord({ amount: 3000,  type: "expense", category: "Rent",   date: "2025-01-15", createdBy: adminUser.id });
  store.createRecord({ amount: 500,   type: "expense", category: "Food",   date: "2025-02-05", createdBy: adminUser.id });

  await test("GET /dashboard/summary — analyst can access", async () => {
    const r = await request("GET", "/dashboard/summary", null, { Authorization: `Bearer ${analystToken}` });
    assert.equal(r.status, 200);
    assert.ok(typeof r.body.data.netBalance === "number");
    assert.ok(typeof r.body.data.byCategory === "object");
    assert.ok(Array.isArray(r.body.data.recent));
  });

  await test("GET /dashboard/summary — viewer cannot access (403)", async () => {
    const r = await request("GET", "/dashboard/summary", null, { Authorization: `Bearer ${viewerToken}` });
    assert.equal(r.status, 403);
  });

  await test("GET /dashboard/trends — returns sorted monthly array", async () => {
    const r = await request("GET", "/dashboard/trends", null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    const months = r.body.data.trends.map(t => t.month);
    assert.deepEqual(months, [...months].sort());
  });

  await test("GET /dashboard/categories — returns percentage breakdown", async () => {
    const r = await request("GET", "/dashboard/categories", null, { Authorization: `Bearer ${analystToken}` });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.categories.every(c => typeof c.percentage === "number"));
  });

  await test("GET /dashboard/summary?dateFrom=2025-01-01&dateTo=2025-01-31 — date filter works", async () => {
    const r = await request("GET", "/dashboard/summary?dateFrom=2025-01-01&dateTo=2025-01-31", null, { Authorization: `Bearer ${analystToken}` });
    assert.equal(r.status, 200);
    // Only Jan records included; Feb expense shouldn't inflate expenses
    assert.equal(r.body.data.totalExpenses, 3000);
  });

  console.log("\nMisc");

  await test("GET /health — health check", async () => {
    const r = await request("GET", "/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, "ok");
  });

  await test("Unknown route returns 404", async () => {
    const r = await request("GET", "/definitely/not/a/route");
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
  });

  // ── Results ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"─".repeat(40)}\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
