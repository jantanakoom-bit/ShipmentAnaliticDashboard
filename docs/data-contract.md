# Data Contract

## Source

The application reads shipment and user data from Google Sheets.

| Sheet | Purpose | Required |
|-------|---------|----------|
| `Detail Data` | Shipment rows, analytics dimensions, tracking fields | Yes |
| `Users` | Login users and roles | Yes |
| `Trade` | Optional trade reference data for legacy workbook imports | No |
| `Carrier` | Optional carrier reference data for legacy workbook imports | No |

The backend reads `Detail Data` through `api/_lib/workbook.js`. Existing sheets without operational tracking columns still load.

## Detail Data Columns

### Core Analytics Columns

| Column | Normalized field | Notes |
|--------|------------------|-------|
| `Date` | `date`, `year`, `quarter`, `monthNumber`, `monthLabel` | Accepts Google Sheets date string or Excel serial number |
| `MONTH` | `monthNumber` fallback | Used only when `Date` cannot be parsed |
| `Booking No` | `bookingNo` | Used in shipment identity fallback |
| `Job No` | `jobNo` | Used in shipment identity fallback |
| `Shipper` | `shipper` | Defaults to `Unknown` |
| `Liner` | `liner` | Defaults to `Unknown` |
| `POL` | `pol` | Defaults to `Unknown` |
| `POD` | `pod` | Defaults to `Unknown` |
| `Destination` | `destination`, `route` | Falls back to `PORT` |
| `PORT` | `port`, `destination` fallback | Defaults to `Unknown` |
| `Country2` / `COUNTRY` | `country` | `Country2` wins when present |
| `Qty` | `qty` | Non-numeric values become `0` |
| `Unit` | `unit` | Used for 20/40 unit breakdown |
| `TEU` | `teu` | Non-numeric values become `0` |
| `Status` | `status` | Defaults to `Unspecified` |
| `Sale Name` | `saleName` | Defaults to `Unknown` |
| `TRADE` | `trade` | Defaults to `Unknown` |
| `CARRIER` | `carrier` | Defaults to `Unknown` |

### Optional Operational Tracking Columns

| Column | Normalized field | Used for |
|--------|------------------|----------|
| `shipment_id` / `Shipment ID` | `shipmentId` | Preferred tracking row identity |
| `container_no` / `Container No` | `containerNo` | Display and future container-level tracking |
| `ETD` | `etd` | Date sequence validation |
| `ETA` | `eta` | Delay and missing-data checks |
| `ATD` | `atd` | Date sequence validation |
| `ATA` | `ata` | Clears delayed/stale state when present |
| `current_milestone` / `Current Milestone` | `currentMilestone` | Tracking page milestones and filters |
| `last_event_time` / `Last Event Time` | `lastEventTime` | Stale update detection |
| `delay_days` / `Delay Days` | `delayDays` | Display/future reporting |
| `delay_reason` / `Delay Reason` | `delayReason` | Display/future reporting |
| `on_time_flag` / `On Time Flag` | `onTimeFlag` | Display/future reporting |

If `shipmentId` is missing, the tracking model builds a fallback ID from `bookingNo`, `jobNo`, and `date`.

### Optional RBAC and CRUD Columns

These columns are required for secure multi-salesperson CRUD. Existing sheets can add them to the right side of `Detail Data`; no current column needs to be renamed or deleted.

| Column | Normalized field | Used for |
|--------|------------------|----------|
| `record_id` / `Record ID` | `recordId` | Stable row identity for API detail, update, and soft delete |
| `owner_user_id` / `Owner User ID` | `ownerUserId` | Primary RBAC ownership key, matched to `Users.id` |
| `owner_username` / `Owner Username` | `ownerUsername` | Human-readable owner fallback and backfill aid |
| `created_by` / `Created By` | `createdBy` | User id that created the row through the website |
| `updated_by` / `Updated By` | `updatedBy` | User id that last updated the row through the website |
| `created_at` / `Created At` | `createdAt` | ISO timestamp for website-created rows |
| `updated_at` / `Updated At` | `updatedAt` | ISO timestamp for latest website update |
| `is_deleted` / `Is Deleted` | `isDeleted` | Soft-delete flag; deleted rows are hidden from normal reads |
| `deleted_at` / `Deleted At` | `deletedAt` | ISO timestamp for soft delete |
| `deleted_by` / `Deleted By` | `deletedBy` | User id that soft-deleted the row |

Compatibility rules:

- Missing RBAC columns do not break read-only dashboard loading.
- Normal `user` accounts only receive rows where `owner_user_id` matches their user id, or where `owner_username` matches their username when `owner_user_id` is blank.
- Rows with blank owner fields are treated as unassigned and are visible only to `moderator` and `admin` until backfilled.
- Website-created rows always receive `record_id`, owner fields, and audit fields from the server-side session.
- Deletes are soft deletes only; rows remain in Google Sheets with `is_deleted=true`.

## Users Sheet

The `Users` sheet must have these headers:

```text
id,username,password_hash,role,display_name,status,created_at,updated_at,last_login_at,password_changed_at
```

Supported roles are `admin`, `moderator`, and `user`. Supported statuses are `active` and `disabled`.

## RBAC Permission Matrix

| Role | View Own Data | View All Data | Create | Update Own | Update All | Delete | Manage Users | Manage Roles | Manage System Settings |
|------|---------------|---------------|--------|------------|------------|--------|--------------|--------------|------------------------|
| `user` | Yes | No | Yes, owned by self | Yes | No | Own soft delete only | No | No | No |
| `moderator` | Yes | Yes | Yes | Yes | Yes | Soft delete any sales record | No | No | No |
| `admin` | Yes | Yes | Yes | Yes | Yes | Soft delete any sales record | Yes | Yes | Existing admin/system controls only |

## Schema Review for RBAC CRUD

| Area | Current support | Gap / risk | Required action |
|------|-----------------|------------|-----------------|
| User roles | `Users.role` exists | Only `admin` and `user` were accepted | Allow `moderator` in validation and admin UI |
| User identity | `Users.id`, `username` exist | No email field currently exists | Use `id` as primary identity and `username` as fallback/display |
| Shipment identity | Optional `shipment_id` exists | Some existing rows may be blank or duplicated | Add `record_id` for CRUD identity; fall back to generated display id for old rows |
| Ownership | `Sale Name` exists | Sales name is not a durable account key | Add `owner_user_id` and `owner_username`; treat blank ownership as unassigned |
| Audit | Tracking fields exist, user audit does not | Cannot prove who created/updated/deleted website rows | Add `created_by`, `updated_by`, timestamps, and soft-delete fields |
| Delete | No write-back workflow | Hard delete would remove audit history | Use soft delete only |
| Backward compatibility | Existing analytics columns load | Old rows lack RBAC metadata | Keep old rows readable to moderator/admin; require backfill before normal users can see them |

Backfill strategy:

1. Add the RBAC/CRUD columns to the right side of `Detail Data`.
2. For each existing row, map `Sale Name` to a `Users` account and fill `owner_user_id` plus `owner_username`.
3. For rows without a clear owner, leave ownership blank so only moderator/admin can review and assign them.
4. Populate `record_id` with unique ids before enabling update/delete for old rows. Website-created rows get ids automatically.

## Compatibility Rules

- Missing optional tracking columns do not break dashboard, analytics, shipments, or AI chat.
- Missing `ETA` or milestone data appears as a tracking exception instead of a load failure.
- Authentication data and Google service credentials must not be exposed to the frontend.
