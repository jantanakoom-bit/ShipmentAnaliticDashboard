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

## Users Sheet

The `Users` sheet must have these headers:

```text
id,username,password_hash,role,display_name,status,created_at,updated_at,last_login_at,password_changed_at
```

Supported roles are `admin` and `user`. Supported statuses are `active` and `disabled`.

## Compatibility Rules

- Missing optional tracking columns do not break dashboard, analytics, shipments, or AI chat.
- Missing `ETA` or milestone data appears as a tracking exception instead of a load failure.
- Authentication data and Google service credentials must not be exposed to the frontend.
