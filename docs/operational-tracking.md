# Operational Tracking

## Purpose

The `/tracking` page turns the existing shipment dataset into an operations follow-up view. It identifies rows that need review and lets operations users assign, prioritize, and resolve exception actions in Google Sheets.

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
6. Open an exception action, assign an owner, set priority/status/due date, and record the latest note.
7. Use the source Google Sheet to correct missing/late operational data when the exception is caused by bad source fields.

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

The UI writes only exception workflow fields. It does not edit milestone source fields, send external notifications, or create event history.

Workflow filters:

- action status
- priority
- action owner
- due state

## Backend API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/tracking` | Returns tracking rows, summary KPIs, milestone summary, and exceptions |
| `GET /api/tracking/exceptions` | Returns only rows that have exception types |
| `PATCH /api/tracking/exceptions/:recordId` | Updates exception workflow fields for an accessible shipment row |

All endpoints require an authenticated session. Normal `user` accounts can update only accessible owned rows; `moderator` and `admin` can update all visible rows.

## Data Requirements

Tracking works best when `Detail Data` includes:

```text
shipment_id,container_no,ETD,ETA,ATD,ATA,current_milestone,last_event_time,delay_days,delay_reason,on_time_flag
```

See [data-contract.md](data-contract.md) for exact column mapping.

Exception workflow writes append these optional columns when missing:

```text
exception_status,exception_priority,exception_owner_user_id,exception_owner_username,exception_next_action,exception_due_at,exception_note,exception_updated_by,exception_updated_at,exception_resolved_by,exception_resolved_at
```

## Current Limits

- No external notifications.
- No event-level movement history table yet.
- AI chat does not yet have tracking-specific tools.

## Recommended Next Iteration

1. Add external notifications for overdue/unassigned exception actions.
2. Add event-level movement data when the source sheet can provide it.
3. Extend AI chat with tracking tools such as `get_tracking_exceptions`.
4. Add export for filtered exception queues.
