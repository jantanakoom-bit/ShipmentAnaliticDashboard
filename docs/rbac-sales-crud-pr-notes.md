# RBAC Sales CRUD Google Sheet Schema PR Notes

## Problem

The dashboard authenticated users through the `Users` Google Sheet, but shipment data from `Detail Data` was returned to every authenticated user. The website also had no shipment write-back workflow, no durable row ownership, and no schema validation for RBAC/audit columns.

## Solution

- Add role-aware backend scoping for shipment workbook data, metadata, analytics, tracking, and AI chat tools.
- Add `moderator` as a supported role between `user` and `admin`.
- Add shipment CRUD endpoints backed by `Detail Data`.
- Use soft delete only.
- Add safe schema validation that appends missing RBAC/CRUD headers without deleting or renaming existing columns.
- Add permission-aware shipment UI for inline create, modal detail/edit, delete confirmation, and moderator/admin salesperson filtering.
- Keep legacy rows with missing ownership visible to moderator/admin review paths while preserving normal user ownership scoping.

## Role Behavior

| Role        | Shipment visibility          | Shipment writes                           | Admin users |
| ----------- | ---------------------------- | ----------------------------------------- | ----------- |
| `user`      | Owned, non-deleted rows only | Create own, update own, soft-delete own   | No          |
| `moderator` | All non-deleted rows         | Create, update, soft-delete sales records | No          |
| `admin`     | All non-deleted rows         | Create, update, soft-delete sales records | Yes         |

Admin navigation is hidden for non-admin users. Direct `/admin` access still returns access denied for `user` and `moderator`.

## Shipment UI Behavior

- `Add Shipment` opens the create form inline on the Shipments page.
- `View <booking>` opens a modal detail dialog for review and update.
- `Delete Shipment` opens a second confirmation dialog before calling the delete API.
- `Cancel` closes only the confirmation dialog and keeps the shipment detail dialog open.
- `Confirm Delete` calls the soft-delete endpoint; no hard delete is introduced.
- Delete errors remain visible in the confirmation flow so the user can retry or cancel.

## Google Sheet Schema Changes

Add these columns to the right side of `Detail Data`:

```text
record_id,owner_user_id,owner_username,created_by,updated_by,created_at,updated_at,is_deleted,deleted_at,deleted_by
```

Backfill existing rows by mapping `Sale Name` to `Users.id` and `Users.username`. Rows with no owner remain visible only to moderator/admin until assigned. Existing analytics/tracking columns remain backward compatible.

## Test Evidence

Baseline before implementation:

```bash
npm test
npm run build
npm run test:e2e
```

Focused checks during implementation:

```bash
npm run test:api -- api/_lib/createApp.test.js
npm run test:api -- api/_lib/shipmentStore.test.js
npm run test:unit -- src/pages/pages.test.jsx
npm run test:e2e -- tests/e2e/shipments.spec.js tests/e2e/admin.spec.js
```

Latest focused UI checks run locally on 2026-06-01:

```bash
npm run test:unit -- src/pages/pages.test.jsx
# 6 files passed, 32 tests passed

npm run test:e2e -- tests/e2e/shipments.spec.js
# 3 tests passed
```

Final PR gate should run:

```bash
npm test
npm run build
npm run test:e2e
```

## Risks And Rollback

- Existing rows without `owner_user_id` or `owner_username` will disappear for normal `user` accounts until backfilled.
- Legacy rows without durable ownership stay reviewable by moderator/admin, but should still be backfilled before assigning them to normal user workflows.
- Website writes require the Google service account to have spreadsheet write permission.
- Rollback is code-only if no writes were made. If writes were made, keep rows and set `is_deleted=false` only for intentionally restored records.
- No hard deletes are introduced.
