# Shipment Analytic Dashboard

Dashboard scaffold for shipment analysis based on `Detail_Report_Format.xlsx`.

## Stack

- Vite
- React
- Recharts
- `xlsx` for client-side workbook parsing

## Run

```bash
npm install
npm run dev
```

Run the backend API in a second terminal:

```bash
npm run dev:server
```

API endpoints:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/workbook`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET /api/metadata`
- `GET /api/analytics?grain=quarter&year=2026`
- `GET /api/shipments?limit=20&carrier=ONE`

## Login Users

Users are stored in a Google Sheet named `Users`. Add these headers in row 1:

```text
id,username,password_hash,role,display_name,status,created_at,updated_at,last_login_at,password_changed_at
```

Create an initial admin row manually. Generate the password hash with:

```bash
npm run hash-password -- your-admin-password
```

Use `role=admin` and `status=active`, then set Google/Vercel environment variables from `.env.example`.

## Docker

```bash
copy .env.example .env
docker compose up --build frontend
```

Open `http://localhost:5173`.

Run the Express backend container as well:

```bash
docker compose --profile backend up --build
```

See `docs/devops.md` for local deployment, environment variable, and smoke-test details.

## Current Scope

- Loads `/public/data/Detail_Report_Format.xlsx`
- Parses `Detail Data`, `Trade`, and `Carrier`
- Includes server-side login with Google Sheets users
- Supports period filters for `month`, `quarter`, and `year`
- Builds a dashboard overview for:
  - shipment rows
  - total TEU
  - total quantity
  - active shippers
  - active routes
  - average TEU per shipment
  - shipment and TEU trend by selected time grain
  - top trade, carrier, destination, shipper, route, and status breakdown
  - shipment detail drill-down table

## Design Reference

- See `docs/dashboard-design.md` for KPI, chart, and tracking design guidance based on the current Excel structure.

## Next Recommended Iteration

- Add shipper, trade, route, and carrier filters
- Standardize `Status` values in the source workbook
- Replace summary-only data with event-level movement data if available
- Add milestone tracking page once ETD/ETA/ATA/event fields exist
