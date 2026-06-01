# API Reference

Base URL: `http://localhost:3001` for the local Express API or same-origin `/api` in Vercel production.

All responses use JSON. Errors return `{ "error": "message" }`.

## Auth

### POST /api/auth/login

Authenticate user and create session.

**Request:**
```json
{ "username": "admin", "password": "secret" }
```

**Response (200):**
```json
{ "user": { "username": "admin", "role": "admin", "displayName": "Admin" } }
```

**Error (401):**
```json
{ "error": "Invalid username or password" }
```

### POST /api/auth/logout

Destroy session.

**Response (200):**
```json
{ "ok": true }
```

### GET /api/auth/session

Check current session status.

**Response (200):**
```json
{ "user": { "username": "admin", "role": "admin" } }
```

**Error (401):** Not authenticated.

---

## Data

### GET /api/workbook

Fetch all shipment data from Google Sheets.

**Auth:** Required (session cookie).

**Response (200):**
```json
{
  "metadata": {
    "source": "Google Sheets: Detail Data",
    "shipments": 128,
    "dateRange": { "min": "2024-01-15T00:00:00.000Z", "max": "2026-05-20T00:00:00.000Z" },
    "filters": { "years": ["2024", "2025", "2026"] }
  },
  "detailData": [
    {
      "date": "2024-01-15",
      "year": 2024,
      "monthNumber": 1,
      "quarter": "Q1",
      "bookingNo": "BK001",
      "jobNo": "J001",
      "shipper": "Company A",
      "saleName": "John",
      "port": "Laem Chabang",
      "country": "USA",
      "trade": "Transpacific",
      "carrier": "Maersk",
      "qty": 5,
      "unit": "40HC",
      "teu": 10,
      "status": "Completed",
      "shipmentId": "SHP-001",
      "eta": "2026-05-20T00:00:00.000Z",
      "currentMilestone": "In Transit"
    }
  ]
}
```

---

### GET /api/metadata

Fetch workbook metadata only.

**Auth:** Required (session cookie).

**Response (200):**
```json
{
  "source": "Google Sheets: Detail Data",
  "shipments": 128,
  "dateRange": { "min": "2024-01-15T00:00:00.000Z", "max": "2026-05-20T00:00:00.000Z" },
  "filters": {
    "years": ["2024", "2025", "2026"],
    "quarters": ["Q1", "Q2"],
    "carriers": ["Maersk", "ONE"]
  }
}
```

### GET /api/shipments

Return filtered shipment rows with a capped result size.

**Auth:** Required (session cookie).

**RBAC:** `user` receives only owned, non-deleted rows. `moderator` and `admin` receive all non-deleted rows.

**Optional query params:** `year`, `quarter`, `month`, `trade`, `carrier`, `shipper`, `status`, `sales`, `limit`.

`limit` is clamped from `1` to `500` and defaults to `100`.

**Response (200):**
```json
{
  "count": 42,
  "rows": [
    {
      "date": "2026-05-01T00:00:00.000Z",
      "bookingNo": "BK001",
      "jobNo": "J001",
      "shipper": "Company A",
      "carrier": "ONE",
      "trade": "Asia",
      "qty": 2,
      "teu": 4,
      "status": "In Transit",
      "shipmentId": "SHP-001",
      "eta": "2026-05-20T00:00:00.000Z",
      "currentMilestone": "In Transit"
    }
  ]
}
```

### POST /api/shipments

Create a shipment row in `Detail Data`.

**Auth:** Required. `user`, `moderator`, and `admin` can create records. For `user`, owner fields are always taken from the session.

**Request:**
```json
{
  "date": "2026-06-01",
  "bookingNo": "BK-100",
  "jobNo": "JOB-100",
  "shipper": "Company A",
  "port": "Tokyo",
  "country": "Japan",
  "trade": "Asia",
  "carrier": "ONE",
  "saleName": "Pan",
  "qty": 2,
  "unit": "40HC",
  "teu": 4,
  "status": "Booked"
}
```

**Response (201):**
```json
{ "row": { "recordId": "uuid", "ownerUserId": "user-1", "bookingNo": "BK-100" } }
```

### GET /api/shipments/:id

Fetch one shipment row by `record_id`.

**RBAC:** `user` can fetch only owned records; `moderator` and `admin` can fetch any non-deleted record.

### PATCH /api/shipments/:id

Update one shipment row.

**RBAC:** `user` can update only owned records. `moderator` and `admin` can update any non-deleted record. Normal users cannot override owner or audit fields.

### DELETE /api/shipments/:id

Soft-delete one shipment row by setting `is_deleted=true` plus delete audit fields.

**RBAC:** `user` can soft-delete only owned records. `moderator` and `admin` can soft-delete any sales record.

### GET /api/analytics

Return aggregate metrics for filtered shipment rows.

**Auth:** Required (session cookie).

**Optional query params:** `year`, `quarter`, `month`, `trade`, `carrier`, `shipper`, `status`, `sales`, `grain`.

`grain` accepts `month`, `quarter`, or `year`; default is `month`.

**Response (200):**
```json
{
  "filteredCount": 42,
  "summary": {
    "shipments": 42,
    "totalTeu": 168,
    "totalQty": 84,
    "uniqueShippers": 12,
    "activeRoutes": 8,
    "averageTeuPerShipment": 4,
    "latestPeriodLabel": "2026-05",
    "shipmentChangePct": 12.5,
    "teuChangePct": 9.1
  },
  "timeSeries": [
    { "label": "2026-05", "shipments": 10, "teu": 40, "qty": 20 }
  ],
  "topTrades": [],
  "topCarriers": [],
  "topDestinations": [],
  "topShippers": [],
  "statusBreakdown": [],
  "routeRanking": [],
  "detailRows": []
}
```

---

## Tracking

### GET /api/tracking

Return operational tracking rows, milestone counts, exception summary, and exception action workflow state for the selected filters.

**Auth:** Required (session cookie).

**Optional query params:** `year`, `quarter`, `month`, `trade`, `carrier`, `shipper`, `status`, `milestone`, `exceptionType`, `sales`, `actionStatus`, `priority`, `actionOwner`, `dueState`.

**Response (200):**
```json
{
  "summary": {
    "totalShipments": 42,
    "delayedShipments": 3,
    "staleShipments": 5,
    "missingDataShipments": 2,
    "invalidSequenceShipments": 1,
    "exceptionShipments": 8,
    "openActionShipments": 6,
    "unassignedActionShipments": 2,
    "overdueActionShipments": 1
  },
  "milestoneSummary": [
    { "name": "In Transit", "count": 18 }
  ],
  "rows": [
    {
      "shipmentId": "SHP-001",
      "bookingNo": "BK001",
      "jobNo": "J001",
      "currentMilestone": "In Transit",
      "eta": "2026-05-20T00:00:00.000Z",
      "lastEventTime": "2026-05-15T09:00:00.000Z",
      "exceptionTypes": ["delayed"],
      "exceptionStatus": "open",
      "exceptionPriority": "high",
      "exceptionOwnerUsername": "tester",
      "exceptionNextAction": "Call carrier",
      "exceptionDueAt": "2026-06-03"
    }
  ]
}
```

**Exception types:** `delayed`, `stale`, `missing_data`, `invalid_sequence`.

### GET /api/tracking/exceptions

Return only tracking rows that require operational review.

**Auth:** Required (session cookie).

**Response (200):**
```json
{
  "count": 1,
  "rows": [
    {
      "shipmentId": "SHP-001",
      "bookingNo": "BK001",
      "exceptionTypes": ["delayed", "stale"]
    }
  ],
  "generatedAt": "2026-06-01T00:00:00.000Z"
}
```

### PATCH /api/tracking/exceptions/:id

Update exception follow-up fields for one accessible shipment row. The `:id` value is the row `recordId`.

**Auth:** Required (session cookie). `user` can update owned rows only; `moderator` and `admin` can update all visible rows.

**Request:**
```json
{
  "actionStatus": "in_progress",
  "priority": "high",
  "ownerUserId": "user-1",
  "ownerUsername": "tester",
  "nextAction": "Call carrier",
  "dueAt": "2026-06-03",
  "note": "Waiting for ETA confirmation"
}
```

**Response (200):**
```json
{
  "row": {
    "recordId": "rec-001",
    "bookingNo": "BK001",
    "exceptionStatus": "in_progress",
    "exceptionPriority": "high",
    "exceptionOwnerUsername": "tester",
    "exceptionUpdatedBy": "user-1",
    "exceptionUpdatedAt": "2026-06-01T00:00:00.000Z"
  }
}
```

Supported action statuses are `open`, `in_progress`, `waiting`, and `resolved`. Supported priorities are `low`, `normal`, `high`, and `urgent`. Audit fields are server-owned.

---

## AI Chat

### POST /api/chat

Send an authenticated chat request to the shipment analytics assistant. OpenAI access stays on the backend.

**Auth:** Required (session cookie).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Summarize top carriers this quarter" }
  ],
  "filters": {
    "year": ["2026"],
    "quarter": ["Q2"]
  },
  "pageContext": {
    "route": "/analytics",
    "title": "Analytics"
  }
}
```

**Response (200):**
```json
{
  "answer": "Here is the shipment summary for the selected filters...",
  "dataUsed": {
    "filters": {
      "year": ["2026"],
      "quarter": ["Q2"]
    },
    "tools": ["get_shipment_summary"],
    "rowsMatched": 42,
    "rowLimitApplied": false
  },
  "requestId": "3f1d1f8c-8b27-4e27-b2d3-2fdd6c52b29d"
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| `400` | Invalid chat payload |
| `401` | Missing or invalid session |
| `403` | Invalid request origin or forbidden access |
| `413` | Workbook row or column limit exceeded |
| `429` | Per-user rate limit exceeded |
| `503` | AI chat is not configured |
| `500` | AI response failed |

---

## Health

### GET /api/health

Health check endpoint. No auth required.

**Response (200):**
```json
{
  "ok": true,
  "service": "shipment-analytic-dashboard-api",
  "workbookFound": true,
  "workbookSource": "Google Sheets: Detail Data",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

## Admin

All admin endpoints require authenticated session with `role: "admin"`.

### GET /api/admin/users

List all users.

**Response (200):**
```json
{
  "users": [
    { "id": "user-1", "username": "admin", "role": "admin", "status": "active" }
  ]
}
```

### POST /api/admin/users

Create a new user.

**Request:**
```json
{ "username": "newuser", "password": "secret", "role": "user", "displayName": "New User" }
```

**Response (201):**
```json
{ "user": { "id": "user-2", "username": "newuser", "role": "user" } }
```

### PATCH /api/admin/users/:id

Update user fields.

**Request:**
```json
{ "role": "admin", "status": "active" }
```

**Response (200):**
```json
{ "user": { "id": "user-2", "username": "newuser", "role": "admin" } }
```
