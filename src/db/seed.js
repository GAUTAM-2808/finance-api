/**
 * Seed script — run once to populate the store with demo data.
 * Usage: node src/db/seed.js
 */

const store = require("./store");
const { hashPassword } = require("../utils/auth");

function seed() {
  console.log("Seeding database…");

  // ── Users ─────────────────────────────────────────────────────────────────
  const admin = store.createUser({
    name: "Alice Admin",
    email: "admin@example.com",
    passwordHash: hashPassword("admin123"),
    role: "admin",
  });

  const analyst = store.createUser({
    name: "Bob Analyst",
    email: "analyst@example.com",
    passwordHash: hashPassword("analyst123"),
    role: "analyst",
  });

  store.createUser({
    name: "Carol Viewer",
    email: "viewer@example.com",
    passwordHash: hashPassword("viewer123"),
    role: "viewer",
  });

  // ── Financial Records ─────────────────────────────────────────────────────
  const entries = [
    { amount: 120000, type: "income",  category: "Salary",       date: "2025-01-05", notes: "January salary" },
    { amount: 8500,   type: "expense", category: "Rent",         date: "2025-01-07", notes: "Monthly rent" },
    { amount: 3200,   type: "expense", category: "Utilities",    date: "2025-01-12", notes: "Electric & water" },
    { amount: 45000,  type: "income",  category: "Freelance",    date: "2025-01-20", notes: "UI project payment" },
    { amount: 1500,   type: "expense", category: "Food",         date: "2025-01-25", notes: "Groceries" },
    { amount: 120000, type: "income",  category: "Salary",       date: "2025-02-05", notes: "February salary" },
    { amount: 8500,   type: "expense", category: "Rent",         date: "2025-02-07" },
    { amount: 12000,  type: "expense", category: "Travel",       date: "2025-02-14", notes: "Client visit flights" },
    { amount: 6000,   type: "expense", category: "Software",     date: "2025-02-20", notes: "Annual subscriptions" },
    { amount: 20000,  type: "income",  category: "Freelance",    date: "2025-02-28", notes: "Logo design project" },
    { amount: 120000, type: "income",  category: "Salary",       date: "2025-03-05" },
    { amount: 8500,   type: "expense", category: "Rent",         date: "2025-03-07" },
    { amount: 4800,   type: "expense", category: "Food",         date: "2025-03-15" },
    { amount: 9500,   type: "expense", category: "Equipment",    date: "2025-03-22", notes: "New keyboard + monitor" },
    { amount: 60000,  type: "income",  category: "Consulting",   date: "2025-03-30", notes: "Q1 consulting fee" },
  ];

  for (const entry of entries) {
    store.createRecord({ ...entry, createdBy: admin.id });
  }

  console.log("✓ Seeded 3 users and", entries.length, "records");
  console.log("\nLogin credentials:");
  console.log("  admin@example.com    / admin123");
  console.log("  analyst@example.com  / analyst123");
  console.log("  viewer@example.com   / viewer123");
}

seed();
