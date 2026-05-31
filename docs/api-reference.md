# API Reference

Base URL: `http://localhost:3001` (dev) or same origin via nginx proxy (prod)

All responses use JSON. Errors return `{ success: false, error: "message" }`.

## Auth

### POST /api/auth/login

Authenticate user and create session.

**Request:**
```json
{ "username": "admin", "password": "secret" }
```

**Response (200):**
```json
{ "success": true, "user": { "username": "admin", "role": "admin", "displayName": "Admin" } }
```

**Error (401):**
```json
{ "success": false, "error": "Invalid username or password" }
```

### POST /api/auth/logout

Destroy session.

**Response (200):**
```json
{ "success": true }
```

### GET /api/auth/session

Check current session status.

**Response (200):**
```json
{ "authenticated": true, "user": { "username": "admin", "role": "admin" } }
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
  "metadata": { "sheetTitle": "...", "lastUpdated": "..." },
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
      "status": "Completed"
    }
  ]
}
```

---

## Health

### GET /api/health

Health check endpoint. No auth required.

**Response (200):**
```json
{ "status": "ok", "timestamp": "2024-01-15T10:00:00.000Z" }
```

---

## Admin

All admin endpoints require authenticated session with `role: "admin"`.

### GET /api/admin/users

List all users.

**Response (200):**
```json
{
  "success": true,
  "users": [
    { "id": 1, "username": "admin", "role": "admin", "active": true }
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
{ "success": true, "user": { "id": 2, "username": "newuser", "role": "user" } }
```

### PATCH /api/admin/users/:id

Update user fields.

**Request:**
```json
{ "role": "admin", "active": true }
```

**Response (200):**
```json
{ "success": true, "user": { "id": 2, "username": "newuser", "role": "admin" } }
```
