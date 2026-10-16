# ReturnDesk

> A returns management desk for a modern online store. Support agents can review, track, approve, reject, resolve, and close customer return requests with rigorous lifecycle enforcement.

**Live Application**: *[Deploy URL will be placed here]*  
**Repository**: [github.com/Arvind-Vishwa/Return_Desk](https://github.com/Arvind-Vishwa/Return_Desk)

---

## Table of Contents

1. [Overview & Tech Stack](#overview--tech-stack)
2. [Business Rules Enforced](#business-rules-enforced)
3. [Architecture & Design Decisions](#architecture--design-decisions)
4. [Database Design](#database-design)
5. [API Documentation](#api-documentation)
6. [Local Setup Guide (From Scratch)](#local-setup-guide-from-scratch)
7. [Running Tests & Seed Verification](#running-tests--seed-verification)
8. [Assumptions & Scope](#assumptions--scope)
9. [Time Spent](#time-spent)

---

## Overview & Tech Stack

ReturnDesk provides customer support teams with a full lifecycle management console for customer returns, replacements, and refunds.

### Technology Choices

- **Frontend**: Next.js 16 (App Router), React 19, Vanilla CSS & Tailwind CSS.
- **Backend**: Next.js Route Handlers (`app/api/*`) running on Node.js.
- **Database**: PostgreSQL (tested with local PostgreSQL & cloud providers like Neon / Supabase).
- **Data Access**: Native PostgreSQL client (`pg` Pool) using parameterized SQL queries with atomic transactions (`BEGIN` / `COMMIT` / `ROLLBACK`).
- **Styling**: Handcrafted CSS design system with CSS custom properties, responsive layout down to 375px mobile screens, dark/light theme support, and micro-interactions.

---

## Business Rules Enforced

Every rule specified in the assignment is enforced **strictly at the server and database level**. The frontend respects these rules by disabling or hiding illegal actions, but any direct API call violating a rule is refused with appropriate HTTP status codes and detailed error messages.

### 1. Status Flow (Lifecycle State Machine)
- **Legal Flow**:
  ```text
  Open ──► In Review ──► Approved ──► Completed
                     └──► Rejected
  ```
- `Rejected` and `Completed` are **terminal** states — nothing moves out of them.
- Any skipping (e.g., `open` straight to `completed`) or backward transition is refused with **HTTP 422 Unprocessable Entity**.

### 2. Approval Requires Resolution
- A request cannot transition to `approved` without a specified resolution:
  - `refund`
  - `replacement`
  - `store_credit`
- If resolution is `refund`, `refund_amount` must be a positive number greater than `0`.
- If resolution is `replacement` or `store_credit`, `refund_amount` must be `NULL` (recording a refund amount is prohibited).
- Refused with **HTTP 422** if these conditions are violated.

### 3. One Live Request per Item (Duplicate Prevention)
- A customer cannot have two concurrent live requests for the same item (`item_sku`) on the same order (`order_number`).
- Enforced at both:
  1. **Database Constraint**: Partial unique index:
     ```sql
     CREATE UNIQUE INDEX idx_unique_live_item_request 
     ON return_requests (lower(order_number), lower(item_sku)) 
     WHERE deleted_at IS NULL AND status NOT IN ('rejected', 'completed');
     ```
  2. **Data Layer Check**: Pre-flight validation returning **HTTP 409 Conflict** with an informative message.
- Once an earlier request reaches `rejected` or `completed` (or is soft-deleted), a new request for that item is immediately allowed.

### 4. Locked Once Decided
- Once a request reaches `approved`, `rejected`, or `completed`, its customer and item details become immutable.
- Any attempt to update fields via `PATCH` is refused with **HTTP 422**.
- **Notes can still be added** at any stage, even on locked or closed requests.

### 5. Soft Removal (Non-Destructive)
- Requests are never destroyed from the database (`DELETE` sets `deleted_at = NOW()`).
- Only requests in `open` or `rejected` status can be removed.
- Attempting to remove an `in_review`, `approved`, or `completed` request returns **HTTP 422**.
- Removed requests are excluded from all default listings and fetches.

---

## Architecture & Design Decisions

### Why Raw SQL (`pg`) instead of an ORM?
1. **Total query transparency**: Server-side filtering, sorting, pagination, and full-text search are done in a single, predictable SQL query with `COUNT(*) OVER()` window function, avoiding the N+1 problem and runtime overhead.
2. **Explicit integrity**: Foreign keys (`ON DELETE CASCADE`), `CHECK` constraints, triggers for automated timestamps (`updated_at`), and partial unique indexes are declared natively in SQL.
3. **Connection pooling & resilience**: Reusable connection pool with automatic SSL detection for serverless cloud environments (Neon, Supabase, Render).

### Human-Readable Reference Numbers
Instead of exposing raw database auto-increment IDs or unreadable UUIDs to support agents and customers, references are generated automatically via a dedicated PostgreSQL sequence:
```sql
CREATE SEQUENCE request_ref_seq START WITH 1001;
-- Formatted as: RET-1001, RET-1002, etc.
```

### Server-Side Filtering, Search & Paging
Loading the entire dataset into the browser was explicitly banned.
- **Search (`q`)**: Searches case-insensitively across `customer_name`, `customer_email`, `order_number`, and `reference` using parameterized `ILIKE`.
- **Filtering**: By `status` and `reason`.
- **Sorting**: By `created_at`, `updated_at`, `reference`, `customer_name`, and `status` with parameterized direction (`asc` / `desc`).
- **Pagination**: `LIMIT $x OFFSET $y` with total count calculated via window function `COUNT(*) OVER()`.
- **Debounced input**: Search bar delays execution by 400ms to avoid firing on every keystroke.

### Standardized Error Envelope
All error responses adhere to a consistent JSON structure inspired by RFC 7807:
```json
{
  "error": {
    "message": "A request cannot be approved without a resolution.",
    "code": "VALIDATION_FAILED",
    "details": {
      "resolution": "Resolution is required when approving a request"
    }
  }
}
```

---

## Database Design

### Schema Overview (`db/schema.sql`)

```
               ┌────────────────────────┐
               │    return_requests     │
               ├────────────────────────┤
               │ id (PK)                │
               │ reference (UNIQUE)     │◄─── Auto RET-XXXX
               │ customer_name          │
               │ customer_email         │
               │ customer_phone         │
               │ order_number           │
               │ item_sku               │
               │ item_name              │
               │ quantity               │
               │ reason (ENUM)          │
               │ description            │
               │ status (ENUM)          │
               │ resolution (ENUM)      │
               │ refund_amount          │
               │ created_at             │
               │ updated_at             │
               │ deleted_at             │
               └───────────┬────────────┘
                           │ 1
                           │
                           │ N
               ┌───────────▼────────────┐
               │     request_notes      │
               ├────────────────────────┤
               │ id (PK)                │
               │ request_id (FK)        │
               │ note (TEXT)            │
               │ created_at             │
               └────────────────────────┘
```

- **Enums**:
  - `request_status`: `'open'`, `'in_review'`, `'approved'`, `'rejected'`, `'completed'`
  - `return_reason`: `'damaged'`, `'wrong_item'`, `'size_issue'`, `'not_as_described'`, `'changed_mind'`
  - `resolution_type`: `'refund'`, `'replacement'`, `'store_credit'`
- **Indexes**:
  - `idx_requests_lookup`: Composite index on `(status, reason, created_at DESC)`.
  - `idx_unique_live_item_request`: Partial unique index enforcing Rule 3.
  - `idx_request_notes_request_id`: Index on `(request_id, created_at ASC)` for fast note timeline rendering.

---

## API Documentation

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/requests` | List requests with search, filter, sort & pagination | `200` |
| `POST` | `/api/requests` | Raise a new return request | `201`, `400`, `409`, `422` |
| `GET` | `/api/requests/:id` | Fetch single request with notes timeline & permissions | `200`, `404` |
| `PATCH` | `/api/requests/:id` | Edit details of an undecided request | `200`, `400`, `404`, `422` |
| `DELETE` | `/api/requests/:id` | Soft delete request (only `open` or `rejected`) | `204`, `404`, `422` |
| `POST` | `/api/requests/:id/status` | Move request through lifecycle | `200`, `400`, `404`, `422` |
| `POST` | `/api/requests/:id/notes` | Append a note to request | `201`, `400`, `404`, `422` |

### Query Parameters for `/api/requests`
- `q`: Search query string (customer, order, reference).
- `status`: Filter by status (`open`, `in_review`, `approved`, `rejected`, `completed`).
- `reason`: Filter by return reason (`damaged`, `wrong_item`, `size_issue`, etc.).
- `sort`: Field to sort on (`created_at`, `updated_at`, `reference`, `customer_name`, `status`).
- `order`: Sort direction (`asc` or `desc`, default `desc`).
- `page`: Page number (default `1`).
- `pageSize`: Items per page (default `10`, max `100`).

---

## Local Setup Guide (From Scratch)

### Prerequisites
- Node.js 18.x or later
- PostgreSQL instance (local or hosted like Neon / Supabase)

### 1. Clone the repository
```bash
git clone https://github.com/Arvind-Vishwa/Return_Desk.git
cd Return_Desk
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file (or copy from `.env.example`):
```bash
cp .env.example .env.local
```

Edit `.env.local` and provide your PostgreSQL connection string:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/returndesk
```
*(If using cloud PostgreSQL like Neon or Supabase, include the full connection URI with SSL credentials)*.

### 4. Run database migrations
Executes `db/schema.sql` to create enums, tables, sequences, triggers, and indexes:
```bash
npm run db:migrate
```

### 5. Seed sample data
Populates **35 diverse return requests** spanning all 5 statuses and 5 reasons, complete with historical notes:
```bash
npm run db:seed
```

### 6. Start development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests & Seed Verification

1. **Verify Database Content**:
   Once seeded, visit the dashboard. You will see 35 records with pagination, status badges, and search functional.
2. **Test Search & Filters**:
   - Type `Priya` or `RET-1005` in search.
   - Filter by status `In Review` or reason `Damaged`.
3. **Test Business Rules**:
   - Open an `Open` request → Click "Start Review" → Moves to `In Review`.
   - In `In Review` → Click "Approve" → Select "Refund" → Try entering `0` (Validation refuses) → Enter `500` → Approved.
   - On an `Approved` request → Observe that "Edit Details" is locked. Try making a `PATCH` request via Postman/curl → Server returns `422 Unprocessable Entity`.
   - On an `Approved` request → Try deleting → Server returns `422 Unprocessable Entity` ("Cannot remove a request in approved status").
   - Add a note → Notes can be appended at any point.

---

## Assumptions & Scope

1. **Currency**: Kept in standard integer/decimal format (represented in local currency cents/paise or whole units).
2. **Notes**: Append-only audit trail; notes cannot be edited or deleted once written.
3. **Authentication**: In line with the assignment brief focusing on core domain logic, data models, and business rules, user authentication was omitted. All actions are performed as an authenticated desk agent.
4. **Soft Deletes**: Soft-deleted requests (`deleted_at IS NOT NULL`) are hidden from UI and list/get endpoints, but remain archived in PostgreSQL.

---

## Time Spent

- **Database Architecture & Schema**: ~1.5 hours
- **Business Rules & Data Layer**: ~2 hours
- **REST API Route Handlers**: ~1 hour
- **Frontend Dashboard, Filters & Components**: ~2.5 hours
- **Detail View, Modals & Validation UI**: ~2 hours
- **Documentation & Polish**: ~1 hour
- **Total**: ~10 hours
