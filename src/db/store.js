/**
 * In-memory store backed by a JSON file for persistence.
 * Chosen for zero-dependency portability; swap with SQLite/Postgres easily.
 *
 * Design: Each collection is a Map keyed by string ID.
 * On every write the store is flushed to disk asynchronously.
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_FILE = path.join(__dirname, "../../data.json");

// ─── helpers ────────────────────────────────────────────────────────────────

function newId() {
  return randomUUID();
}

function now() {
  return new Date().toISOString();
}

// ─── initial state ───────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  users: [],
  records: [],
};

// ─── Store class ─────────────────────────────────────────────────────────────

class Store {
  constructor() {
    this._data = this._load();
    // Build Maps from arrays for O(1) lookup
    this._users   = new Map(this._data.users.map(u => [u.id, u]));
    this._records = new Map(this._data.records.map(r => [r.id, r]));
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      return JSON.parse(raw);
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  _flush() {
    const payload = JSON.stringify(
      {
        users:   Array.from(this._users.values()),
        records: Array.from(this._records.values()),
      },
      null,
      2
    );
    fs.writeFile(DATA_FILE, payload, () => {}); // fire-and-forget
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  createUser({ name, email, passwordHash, role = "viewer", status = "active" }) {
    if (this.getUserByEmail(email)) {
      throw Object.assign(new Error("Email already registered"), { status: 409 });
    }
    const user = {
      id: newId(),
      name,
      email,
      passwordHash,
      role,      // viewer | analyst | admin
      status,    // active | inactive
      createdAt: now(),
    };
    this._users.set(user.id, user);
    this._flush();
    return user;
  }

  getUser(id) {
    return this._users.get(id) ?? null;
  }

  getUserByEmail(email) {
    for (const u of this._users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  listUsers() {
    return Array.from(this._users.values());
  }

  updateUser(id, updates) {
    const user = this._users.get(id);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    // Guard: email uniqueness if changing email
    if (updates.email && updates.email !== user.email) {
      if (this.getUserByEmail(updates.email)) {
        throw Object.assign(new Error("Email already in use"), { status: 409 });
      }
    }

    const ALLOWED = ["name", "email", "passwordHash", "role", "status"];
    for (const key of ALLOWED) {
      if (updates[key] !== undefined) user[key] = updates[key];
    }
    user.updatedAt = now();
    this._flush();
    return user;
  }

  deleteUser(id) {
    if (!this._users.has(id)) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }
    this._users.delete(id);
    this._flush();
  }

  // ── Financial Records ─────────────────────────────────────────────────────

  createRecord({ amount, type, category, date, notes, createdBy }) {
    const record = {
      id: newId(),
      amount: Number(amount),
      type,      // income | expense
      category,
      date,
      notes: notes ?? "",
      createdBy,
      deleted: false,
      createdAt: now(),
    };
    this._records.set(record.id, record);
    this._flush();
    return record;
  }

  getRecord(id) {
    const r = this._records.get(id);
    return r && !r.deleted ? r : null;
  }

  /**
   * List records with optional filters.
   * All filters are AND-combined.
   */
  listRecords({ type, category, dateFrom, dateTo, page = 1, limit = 20 } = {}) {
    let results = Array.from(this._records.values()).filter(r => !r.deleted);

    if (type)     results = results.filter(r => r.type === type);
    if (category) results = results.filter(r => r.category.toLowerCase() === category.toLowerCase());
    if (dateFrom) results = results.filter(r => r.date >= dateFrom);
    if (dateTo)   results = results.filter(r => r.date <= dateTo);

    // Sort newest first
    results.sort((a, b) => b.date.localeCompare(a.date));

    const total = results.length;
    const offset = (page - 1) * limit;
    const items  = results.slice(offset, offset + limit);

    return { items, total, page: Number(page), limit: Number(limit) };
  }

  updateRecord(id, updates) {
    const record = this._records.get(id);
    if (!record || record.deleted) {
      throw Object.assign(new Error("Record not found"), { status: 404 });
    }
    const ALLOWED = ["amount", "type", "category", "date", "notes"];
    for (const key of ALLOWED) {
      if (updates[key] !== undefined) {
        record[key] = key === "amount" ? Number(updates[key]) : updates[key];
      }
    }
    record.updatedAt = now();
    this._flush();
    return record;
  }

  /** Soft delete */
  deleteRecord(id) {
    const record = this._records.get(id);
    if (!record || record.deleted) {
      throw Object.assign(new Error("Record not found"), { status: 404 });
    }
    record.deleted   = true;
    record.deletedAt = now();
    this._flush();
  }

  // ── Dashboard aggregation ─────────────────────────────────────────────────

  getSummary({ dateFrom, dateTo } = {}) {
    let records = Array.from(this._records.values()).filter(r => !r.deleted);
    if (dateFrom) records = records.filter(r => r.date >= dateFrom);
    if (dateTo)   records = records.filter(r => r.date <= dateTo);

    let totalIncome = 0, totalExpenses = 0;
    const byCategory = {};
    const byMonth    = {};

    for (const r of records) {
      if (r.type === "income")  totalIncome   += r.amount;
      if (r.type === "expense") totalExpenses += r.amount;

      const cat = r.category || "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + r.amount;

      const month = r.date.slice(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
      byMonth[month][r.type === "income" ? "income" : "expense"] += r.amount;
    }

    // Recent 10 transactions
    const recent = records
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      byCategory,
      byMonth,
      recent,
    };
  }
}

// Singleton
module.exports = new Store();
