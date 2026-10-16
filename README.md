# ReturnDesk

A returns desk for a small online store. Support agents raise return requests, find them quickly, move them through a fixed lifecycle, record decisions and notes, and take them off the desk without losing the record.

**Live app:** https://return-desk-gwgj.vercel.app/requests 
**Time spent:** about 7 hours

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (App Router) + React, JavaScript | Required; JavaScript so every line is easy to explain |
| Backend | Next.js route handlers (`app/api/...`) | One project, one deployment, no CORS |
| Database | PostgreSQL on Neon | Required; free hosted Postgres reachable from local and Vercel |
| Query layer | Raw SQL with `pg` | Every query is visible and reviewable; no ORM magic |
| Styling | Tailwind CSS | Required |
| Hosting | Vercel | Built for Next.js, deploys from GitHub |

---

## Run it locally (clean machine)

**Prerequisites:** Node.js 20+, Git, and a PostgreSQL database (a free Neon project works, or local Postgres).

```bash
git clone https://github.com/Arvind-Vishwa/Return_Desk.git
cd Return_Desk
npm install
```

Create `.env.local` from the example and put your connection string in it:

```bash
cp .env.example .env.local
# edit .env.local -> DATABASE_URL=postgresql://user:password@host/db?sslmode=require
```

Build the database from empty and load seed data:

```bash
npm run db:setup     # = db:migrate (create schema) + db:seed (36 requests)
```

Start the app:

```bash
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run db:migrate` | Drops and recreates all tables, types, indexes and the trigger from `db/schema.sql` |
| `npm run db:seed` | Empties the tables and inserts 36 requests (every status x every reason) with notes |
| `npm run db:setup` | Both of the above. Safe to run repeatedly |

> `db:migrate` destroys existing data by design: it rebuilds the schema from empty.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. On Vercel use Neon's **pooled** string (host contains `-pooler`). |

---

## Project structure

```
app/
  layout.js                       header + page frame
  page.js                         redirects / to /requests
  requests/page.js                list page (wraps RequestList in Suspense)
  requests/new/page.js            create page
  requests/[id]/page.js           detail page: actions, approval, edit, notes
  api/requests/route.js           GET list, POST create
  api/requests/[id]/route.js      GET one, PATCH edit, DELETE soft delete
  api/requests/[id]/status/route.js   POST status change
  api/requests/[id]/notes/route.js    POST add note
components/
  RequestList.js                  search, filters, sort, paging
  RequestForm.js                  shared create/edit form
  StatusBadge.js                  coloured status pill
lib/
  db.js                           pg pool + transaction helper
  constants.js                    statuses, reasons, transitions, labels (shared by API and UI)
  errors.js                       ApiError, error responses, Postgres error mapping
  validation.js                   all input validation
  requests.js                     all SQL and business rules
  api.js                          browser fetch helper that never swallows errors
db/
  schema.sql                      full schema
  migrate.js                      runs schema.sql
  seed.js                         seed data
```

Route files are deliberately thin: read input, validate with `lib/validation.js`, call `lib/requests.js`, return JSON. Business rules exist in exactly one place.

---

## Data model

Two tables: `return_requests` and `request_notes`.

| Decision | Reason |
| --- | --- |
| Postgres `ENUM` types for status, reason, resolution | The database rejects any value outside the allowed set |
| `reference` generated from a `SEQUENCE` (`RD-001001`) | Unique, human-readable, safe under concurrent inserts; the user never types it |
| Separate `id` (internal key) and `reference` (for humans) | References never change and are not used as foreign keys |
| `NUMERIC(10,2)` for `refund_amount` | Exact money values; floats would introduce rounding errors |
| `CHECK` constraints for non-empty text, quantity > 0, email shape | Bad data cannot be stored even if the API had a bug |
| `CHECK refund_amount_matches_resolution` and `decided_needs_resolution` | Rule 2 guaranteed at database level |
| Partial unique index `one_live_request_per_item` on `(lower(order_number), lower(item_sku))` where status is not Rejected/Completed and not deleted | Rule 3 enforced atomically; no race condition between two simultaneous creates |
| `deleted_at TIMESTAMPTZ` | Soft delete: row is kept forever, every query filters `deleted_at IS NULL` |
| `request_notes.request_id` with `ON DELETE RESTRICT` | Requests are never hard-deleted, so notes can never be orphaned |
| Trigger `notes_are_append_only` | The database itself refuses UPDATE/DELETE on notes |
| Partial indexes on status, reason, created_at (non-deleted rows) | Support the list page's filters and default sort |

---

## API

All endpoints return JSON. Successful responses use `{ "data": ... }`; lists add `meta`.

| Method | URL | Purpose | Success |
| --- | --- | --- | --- |
| GET | `/api/requests` | List with search, filters, sort and paging | 200 |
| POST | `/api/requests` | Create a request | 201 |
| GET | `/api/requests/:id` | One request with all notes (oldest first) | 200 |
| PATCH | `/api/requests/:id` | Edit customer/item details | 200 |
| DELETE | `/api/requests/:id` | Soft delete (take off the desk) | 204 |
| POST | `/api/requests/:id/status` | Change status (with resolution when approving) | 200 |
| POST | `/api/requests/:id/notes` | Add a note | 201 |

**List query parameters:** `q` (searches customer name, email, order number, reference), `status`, `reason`, `sort` (`created_at`, `updated_at`, `reference`, `customer_name`, `status`), `order` (`asc`/`desc`), `page`, `pageSize` (1-100). All filtering, sorting and paging is done in SQL (`WHERE`, `ORDER BY`, `LIMIT/OFFSET`).

```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 10, "total": 36, "totalPages": 4 } }
```

Each request includes `allowed_transitions`, `can_edit` and `can_remove`, computed on the server from the same rules it enforces, so the UI never re-implements them.

**Status change body:**

```json
{ "status": "approved", "resolution": "refund", "refund_amount": 499.50 }
```

### Errors

Every error has the same shape:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "Cannot move from Open to Completed. Allowed next: In Review.", "details": { ... } } }
```

| Status | Meaning | Codes |
| --- | --- | --- |
| 400 | Malformed request | `INVALID_JSON`, `INVALID_QUERY` |
| 404 | Not found or soft-deleted | `NOT_FOUND` |
| 409 | Valid input, but the request's current state forbids it | `INVALID_TRANSITION`, `REQUEST_LOCKED`, `DUPLICATE_LIVE_REQUEST`, `NOT_REMOVABLE` |
| 422 | Invalid or missing fields (`details` lists each field) | `VALIDATION_ERROR`, `CONSTRAINT_VIOLATION` |
| 500 | Unexpected bug only (logged server-side, no internals leaked) | `INTERNAL_ERROR` |

Every route is wrapped in `withErrors`, so no handler can return an HTML error page or a 200 with an error inside.

Note: `id` and `refund_amount` are returned as strings, because `pg` returns BIGINT and NUMERIC as strings to avoid precision loss.

---

## How each business rule is enforced

| Rule | Server enforcement | Database guarantee |
| --- | --- | --- |
| 1. Status flow | `TRANSITIONS` map checked in `changeStatus` -> 409 `INVALID_TRANSITION` | - |
| 2. Approval needs a resolution | `validateStatusChange` -> 422 | `decided_needs_resolution` and `refund_amount_matches_resolution` CHECKs |
| 3. One live request per item | Postgres unique violation mapped to 409 `DUPLICATE_LIVE_REQUEST` | `one_live_request_per_item` partial unique index |
| 4. Locked once decided | `LOCKED_STATUSES` checked in `updateRequest` -> 409 `REQUEST_LOCKED` | - |
| 5. Removal | `REMOVABLE_STATUSES` checked in `removeRequest` -> 409 `NOT_REMOVABLE`; sets `deleted_at` | Rows are never deleted; notes use `ON DELETE RESTRICT` |

Status, edit and remove operations run in a transaction with `SELECT ... FOR UPDATE`, so two agents cannot act on the same request at the same moment.

---

## Frontend

- **List:** status badges with distinct colours; search, status/reason filters, sort and paging all stored in the URL (refresh, back button and shared links keep state).
- **Debounced search:** the URL (and the fetch) updates 400 ms after typing stops.
- **Stale responses ignored:** each fetch effect cancels the previous one so an old slow response cannot overwrite a newer one.
- **States:** loading, error (server message shown), and an explicit empty message instead of a blank table.
- **Detail:** only legal actions are shown, driven by `allowed_transitions` / `can_edit` / `can_remove` from the API. Every refused action shows the server's reason.
- **Forms:** one shared form for create and edit; server field errors appear under each field. Validation lives only on the server, so there is one source of truth.
- **Responsive:** table on desktop, cards below the `md` breakpoint; usable at 375 px.

---

## Assumptions

- **Rejected is only reachable from In Review**, following the diagram in the brief. An Open request must be reviewed before it can be rejected.
- **A soft-deleted Open request no longer counts as live**, so a new request for the same order and item is allowed.
- **Order and item are free-text fields** (order number, SKU, item name). There is no orders or product catalogue in the brief.
- **Duplicate detection is case-insensitive** on order number and SKU.
- **Currency is INR (₹)**; refund amounts allow up to 2 decimals.
- **There is no authentication**; all users act as a single support agent. Notes are authored as "Support agent".
- **Every status change also writes a "System" note**, giving an audit trail in the notes timeline.
- **When a request is Completed it keeps the resolution it was approved with.**

---

## Testing the rules

The business rules were tested directly against the API with curl (see the commands below), independently of the UI. After `npm run db:setup`: id 1 is Open, 2 In Review, 3 Approved, 4 Rejected, 5 Completed.

```bash
API=http://localhost:3000/api/requests
curl -i -X POST $API/1/status -H "Content-Type: application/json" -d '{"status":"completed"}'   # 409
curl -i -X POST $API/2/status -H "Content-Type: application/json" -d '{"status":"approved"}'    # 422
curl -i -X PATCH $API/3 -H "Content-Type: application/json" -d '{"quantity":2}'                # 409
curl -i -X DELETE $API/3                                                                         # 409
```

---

## What is done

- [x] PostgreSQL schema with constraints, partial unique index, soft delete and append-only notes
- [x] Seed script: 36 requests across every status and reason, with notes
- [x] REST API with consistent response and error shapes
- [x] All five business rules enforced on the server
- [x] List page with server-side search, filters, sort and paging
- [x] Create, detail, edit, status change, approval, notes and removal in the UI
- [x] Loading, empty and error states; server errors surfaced; responsive to 375 px
- [x] Deployed on Vercel with Neon  ← remove if not true

## What is not done / next steps

- Automated tests (e.g. Vitest against a test database) for every rule
- Authentication and real per-agent note authors
- A `pg_trgm` index to make `ILIKE` search fast on large tables
- Cursor-based paging for very large result sets
- Versioned migrations instead of a single drop-and-recreate schema file

## Design alternatives considered

| Chosen | Alternative | Why chosen |
| --- | --- | --- |
| Separate `POST /:id/status` endpoint | `PATCH { status }` | Status changes have their own rules and payload; keeps PATCH for details only |
| Raw SQL | Prisma / Drizzle | Full control and visibility of every query |
| Offset paging | Cursor paging | Simple and supports "page X of Y"; fine at this scale |
| System notes for status history | Separate `status_history` table | Gives a single timeline with less schema; a history table is a good next step |
| Client components calling the API | Server components querying the DB | Familiar React patterns and the UI exercises the same API reviewers test |
| Next.js route handlers | Separate Express service | One deployment, no CORS |