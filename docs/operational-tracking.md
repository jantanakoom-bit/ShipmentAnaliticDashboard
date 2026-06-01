# Operational Tracking

## Purpose

The `/tracking` page turns the existing shipment dataset into a read-only operations follow-up view. It does not update Google Sheets. It identifies rows that need review and gives operations users a focused exception queue.

## User Workflow

1. Log in.
2. Open **Tracking** from the sidebar.
3. Review high-level KPIs:
   - tracked shipments
   - delayed shipments
   - stale updates
   - missing data
   - invalid dates
   - total exceptions
4. Review milestone counts.
5. Filter the exception queue by exception type, milestone, carrier, trade, or sale.
6. Use the source Google Sheet to correct missing/late operational data.

## Exception Rules

| Type | Condition |
|------|-----------|
| `delayed` | `ETA` is before the current time and `ATA` is missing |
| `stale` | `last_event_time` is more than 7 days old and `ATA` is missing |
| `missing_data` | `ETA` is missing, or milestone is missing/`Unspecified` |
| `invalid_sequence` | `ETA < ETD` or `ATA < ATD` |

Rows can have more than one exception type.

## Frontend Behavior

The page uses the same global filters already owned by `App.jsx`:

- year
- quarter
- month
- port
- country
- trade
- carrier
- sale

The Tracking page then adds local filters:

- exception type
- milestone
- carrier
- trade
- sale

The UI is intentionally read-only for the MVP. It shows operational risk but does not assign owners, send notifications, or write back to Google Sheets.

## Backend API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/tracking` | Returns tracking rows, summary KPIs, milestone summary, and exceptions |
| `GET /api/tracking/exceptions` | Returns only rows that have exception types |

Both endpoints require an authenticated session.

## Data Requirements

Tracking works best when `Detail Data` includes:

```text
shipment_id,container_no,ETD,ETA,ATD,ATA,current_milestone,last_event_time,delay_days,delay_reason,on_time_flag
```

See [data-contract.md](data-contract.md) for exact column mapping.

## Current Limits

- No write-back to Google Sheets.
- No owner/action workflow.
- No notifications.
- No event-level movement history table yet.
- AI chat does not yet have tracking-specific tools.

## Recommended Next Iteration

1. Add an owner/action workflow for exception follow-up.
2. Add event-level movement data when the source sheet can provide it.
3. Extend AI chat with tracking tools such as `get_tracking_exceptions`.
4. Add export for filtered exception queues.
