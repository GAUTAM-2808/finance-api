# Finance API

A backend for a finance dashboard system with role-based access control, financial record management, and summary analytics.

Built with **zero external dependencies** — only Node.js built-in modules (`http`, `crypto`, `fs`). This makes setup instant: clone, seed, run.

---

## Quick Start

```bash
# 1. Seed demo data (creates 3 users + 15 sample records)
node src/db/seed.js

# 2. Start the server
node src/server.js

# 3. (Optional) Run the test suite
node tests/run.js
```

Server starts on **http://localhost:3000**. Set `PORT` env var to change it.

### Demo credentials (after seeding)

| Email                   | Password    | Role     |
|-------------------------|-------------|----------|
| admin@example.com       | admin123    | admin    |
| analyst@example.com     | analyst123  | analyst  |
| viewer@example.com      | viewer123   | viewer   |

---

## Project Structure

```
finance-api/
├── src/
│   ├── server.js              # Entry point, HTTP server, route dispatch
│   ├── router.js              # Minimal HTTP router (path params, middleware chains)
│   ├── db/
│   │   ├── store.js           # In-memory store + JSON persistence
│   │   └── seed.js            # Demo data seeder
│   ├── middleware/
│   │   └── index.js           # parseBody, parseQuery, authenticate, requireRole
│   ├── routes/
│   │   ├── auth.js            # POST /auth/login
│   │   ├── users.js           # CRUD /users
│   │   ├── records.js         # CRUD /records
│   │   └── dashboard.js       # GET /dashboard/*
│   └── utils/
│       ├── auth.js            # Password hashing (PBKDF2) + JWT (HMAC-SHA256)
│       ├── validators.js      # Input validation functions
│       └── response.js        # Consistent JSON response helpers
├── tests/
│   └── run.js                 # 30 integration tests, no test framework needed
├── data.json                  # Auto-created on first write
└── README.md
```

---

## Architecture Decisions

### Why zero dependencies?

Demonstrating that the core patterns (routing, auth, validation, persistence) are understood at the implementation level rather than delegated to libraries. In a real project I'd use Express, Zod, and jsonwebtoken — the design is intentionally shaped to swap those in easily.

### Data persistence

The `Store` class uses an in-memory `Map` for O(1) lookups and flushes to `data.json` asynchronously on every write. This gives you fast reads, survivable restarts, and zero database setup. Replacing it with SQLite or Postgres requires only rewriting `store.js` — all business logic and routes are decoupled from the storage layer.

### Authentication

JWT tokens are signed with HMAC-SHA256 using the `crypto` module. The payload contains `{ sub: userId, role, exp }`. On every authenticated request, the user is re-fetched from the store so that role changes and deactivations take effect immediately without waiting for token expiry.

Passwords are hashed with PBKDF2 (SHA-256, 100k iterations, 16-byte random salt) — a standard key derivation function that is safe for production use.

Set `JWT_SECRET` as an environment variable in any real deployment.

### Role hierarchy

```
viewer (1) → analyst (2) → admin (3)
```

The `requireRole` middleware checks a numeric hierarchy level, so `requireAnalyst` accepts analysts **and** admins. New roles can be added to `ROLE_HIERARCHY` in `middleware/index.js`.

### Soft deletes

Financial records are never hard-deleted. The `deleted` and `deletedAt` fields are set instead, and all queries filter `deleted: false`. This preserves audit trails, which matters for financial data.

---

## API Reference

All responses follow this envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "...", "details": [...] } }
```

### Authentication

All routes except `POST /auth/login` require:
```
Authorization: Bearer <token>
```

---

### Auth

#### `POST /auth/login`
```json
// Request
{ "email": "admin@example.com", "password": "admin123" }

// Response 200
{ "token": "...", "user": { "id": "...", "name": "Alice Admin", "role": "admin", ... } }
```

---

### Users — `admin` only (except `/users/me`)

#### `GET /users`
List all users. Returns `{ users: [...], total: N }`.

#### `GET /users/me`
Returns the authenticated user's own profile. Any role.

#### `GET /users/:id`
Get a single user by ID.

#### `POST /users`
Create a user.
```json
{
  "name": "Jane Doe",       // required, min 2 chars
  "email": "jane@co.com",   // required, unique
  "password": "secret123",  // required, min 6 chars
  "role": "analyst",        // optional: viewer | analyst | admin (default: viewer)
  "status": "active"        // optional: active | inactive (default: active)
}
```

#### `PATCH /users/:id`
Partial update. Admins can change any field including `role` and `status`. Users can update their own `name`, `email`, and `password` only.

#### `DELETE /users/:id`
Hard delete. Admins cannot delete themselves.

---

### Financial Records

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/records` | any | List records (filtered, paginated) |
| `GET` | `/records/:id` | any | Get a record |
| `POST` | `/records` | admin | Create a record |
| `PATCH` | `/records/:id` | admin | Update a record |
| `DELETE` | `/records/:id` | admin | Soft-delete a record |

#### Query parameters for `GET /records`

| Param | Type | Description |
|-------|------|-------------|
| `type` | `income` \| `expense` | Filter by type |
| `category` | string | Filter by category (case-insensitive) |
| `dateFrom` | `YYYY-MM-DD` | Include records on/after this date |
| `dateTo` | `YYYY-MM-DD` | Include records on/before this date |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20, max: 100) |

#### Record schema
```json
{
  "amount": 12000,         // required, positive number
  "type": "income",        // required: income | expense
  "category": "Salary",   // required
  "date": "2025-03-01",   // required, YYYY-MM-DD
  "notes": "March salary" // optional
}
```

---

### Dashboard — `analyst` and `admin` only

#### `GET /dashboard/summary`
```json
{
  "totalIncome": 305000,
  "totalExpenses": 48200,
  "netBalance": 256800,
  "byCategory": { "Salary": 360000, "Rent": 25500, ... },
  "byMonth": { "2025-01": { "income": 165000, "expense": 13200 }, ... },
  "recent": [ ...last 10 records ]
}
```

#### `GET /dashboard/trends`
Monthly trend data in chart-friendly array format:
```json
{
  "trends": [
    { "month": "2025-01", "income": 165000, "expense": 13200, "net": 151800 },
    ...
  ]
}
```

#### `GET /dashboard/categories`
Category breakdown sorted by amount descending:
```json
{
  "categories": [
    { "name": "Salary", "amount": 360000, "percentage": 74.8 },
    ...
  ]
}
```

All dashboard endpoints accept optional `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` filters.

---

## Access Control Matrix

| Action | viewer | analyst | admin |
|--------|:------:|:-------:|:-----:|
| Login | ✓ | ✓ | ✓ |
| View own profile | ✓ | ✓ | ✓ |
| Update own profile | ✓ | ✓ | ✓ |
| List/view records | ✓ | ✓ | ✓ |
| View dashboard/summary | — | ✓ | ✓ |
| View dashboard/trends | — | ✓ | ✓ |
| View dashboard/categories | — | ✓ | ✓ |
| Create/edit/delete records | — | — | ✓ |
| Manage users | — | — | ✓ |

---

## Error Codes

| HTTP | Code | When |
|------|------|------|
| 400 | `BAD_REQUEST` | Invalid request body or parameters |
| 401 | `UNAUTHORIZED` | Missing, expired, or invalid token |
| 403 | `FORBIDDEN` | Authenticated but insufficient role |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate email |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Validation errors include a `details` array listing each field issue:
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": [
      "amount: required, must be a positive number",
      "date: required, must be in YYYY-MM-DD format"
    ]
  }
}
```

---

## Tradeoffs & What I'd Change for Production

| Topic | Current | Production swap |
|-------|---------|----------------|
| Database | JSON file | PostgreSQL via `pg` or SQLite via `better-sqlite3` |
| HTTP framework | Custom router | Express or Fastify |
| Validation | Custom functions | Zod schemas |
| JWT | Manual HMAC | `jsonwebtoken` package |
| Password hashing | PBKDF2 (built-in) | bcrypt (stronger, same API shape) |
| Soft deletes | Boolean flag | Dedicated `deleted_at` column with DB-level filtering |
| Rate limiting | Not implemented | Token bucket per IP in middleware |
| Logging | `console.error` | Structured JSON logger (pino) |
| Tests | HTTP integration tests | Unit tests per service + integration tests |

The zero-dependency constraint was a deliberate demo choice. Every module boundary (store, auth utils, validators, response helpers, middleware) is designed so that the implementation behind it can be replaced without touching the routes.
