# Shipment Analytic Dashboard

Authenticated shipment analytics and operational tracking dashboard backed by Google Sheets.

## Stack

- Vite
- React
- Recharts
- Express/Vercel API handlers
- Google Sheets API
- OpenAI SDK for the optional AI assistant

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
- `POST /api/shipments`
- `GET /api/shipments/:id`
- `PATCH /api/shipments/:id`
- `DELETE /api/shipments/:id`
- `GET /api/tracking?milestone=In%20Transit`
- `GET /api/tracking/exceptions?exceptionType=delayed`
- `POST /api/chat`

## Login Users

Users are stored in a Google Sheet named `Users`. Add these headers in row 1:

```text
id,username,password_hash,role,display_name,status,created_at,updated_at,last_login_at,password_changed_at
```

Create an initial admin row manually. Generate the password hash with:

```bash
npm run hash-password -- your-admin-password
```

Use `role=admin` and `status=active`, then set Google/Vercel environment variables from `.env.example`. Supported roles are `admin`, `moderator`, and `user`.

## Docker

```bash
cp .env.example .env
docker compose up --build frontend
```

Open `http://localhost:5173`.

Run the Express backend container as well:

```bash
docker compose --profile backend up --build
```

See `docs/deployment.md` for local deployment, environment variable, and smoke-test details.

## Current Scope

- Loads `Detail Data` from Google Sheets
- Parses analytics fields and optional operational tracking fields
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
  - read-only operational tracking page with milestone summary and exception queue

## Optional Operational Tracking Columns

Add these headers to `Detail Data` when milestone tracking is available. Existing sheets without these columns still load.

```text
shipment_id,container_no,ETD,ETA,ATD,ATA,current_milestone,last_event_time,delay_days,delay_reason,on_time_flag
```

The tracking page classifies delayed shipments, stale updates, missing operational data, and invalid ETD/ETA or ATD/ATA date sequences.

## Design Reference

- See `docs/architecture.md` for system architecture.
- See `docs/data-contract.md` for Google Sheets column requirements.
- See `docs/operational-tracking.md` for tracking rules and workflow.
- See `docs/ai-chat-system-design.md` for AI chat behavior.
- See `docs/testing.md` for verification strategy.

## Next Recommended Iteration

- Standardize `Status` values in the source workbook
- Add event-level movement history once source data is available
- Add owner/action workflow and notifications for exception follow-up
- Extend AI assistant with operational tracking tools

## RBAC Sales CRUD

Shipment CRUD uses `Detail Data` rows as sales records. Normal `user` accounts can only see and modify rows owned by their `Users.id` or username fallback. `moderator` can view and manage all shipment records but cannot manage users, roles, or system settings. `admin` keeps full user-management access.

On the Shipments page, creating a shipment uses the inline form. Viewing an existing shipment opens a detail dialog for review and edits. Delete actions require a confirmation dialog and use soft delete only, so deleted rows remain in Google Sheets with audit fields instead of being removed.

After create, update, delete, or record-id backfill, the backend invalidates the in-process workbook cache before the frontend refreshes data. This avoids the previous behavior where `/api/workbook` could return stale Google Sheets rows for up to 45 seconds after a successful shipment write.

Add these optional columns to the right side of `Detail Data` before enabling website write-back on an existing production sheet:

```text
record_id,owner_user_id,owner_username,created_by,updated_by,created_at,updated_at,is_deleted,deleted_at,deleted_by
```

Existing sheets can populate missing `record_id` values with the backfill script:

```bash
npm run backfill-record-ids
npm run backfill-record-ids -- --apply
```

The default mode is a dry-run. Use `--apply` only when the Google service account has write access and the target sheet has been reviewed.

See `docs/data-contract.md` for the permission matrix, schema review, and backfill strategy. See `docs/rbac-sales-crud-pr-notes.md` for branch-specific review notes and verification evidence.
