# Dashboard Design For Shipment Tracking

## Objective

Turn `Detail_Report_Format.xlsx` into a shipment analysis dashboard that supports:

- month tracking
- quarter tracking
- year tracking
- shipment drill-down
- future extension to operational shipment tracking

## Data Available Today

Primary source is the `Detail Data` sheet with these usable dimensions:

- time: `Date`, `MONTH`
- shipment reference: `Booking No`, `Job No`
- customer: `Shipper`, `Sale Name`
- route: `POL`, `POD`, `Destination`, `Country2`, `PORT`, `COUNTRY`, `TRADE`
- carrier: `Liner`, `CARRIER`
- volume: `Qty`, `Unit`, `TEU`
- status: `Status`

Reference sheets:

- `Trade`
- `Carrier`

## Recommended Dashboard Structure

### 1. Executive Overview

Use for fast performance review.

KPIs:

- shipment rows
- total TEU
- total qty
- active shippers
- active routes
- average TEU per shipment

Charts:

- shipment and TEU trend by month / quarter / year
- trade mix by TEU
- top carrier by TEU
- top destination by TEU

### 2. Commercial And Route Analysis

Use for market and route concentration review.

KPIs and visuals:

- top shipper by TEU
- top trade by TEU
- top route `POL -> Destination`
- route concentration table
- trade share by period

### 3. Shipment Drill-Down

Use for operations follow-up.

Table columns:

- date
- booking no
- job no
- shipper
- route
- trade
- carrier
- qty
- TEU
- status

## Time Design

The dashboard should support three time grains:

- `Month`
- `Quarter`
- `Year`

Recommended filters:

- `View`: month / quarter / year
- `Year`
- `Quarter`
- `Month`

Recommended drill path:

- Year -> Quarter -> Month -> Shipment Detail

## Recommended Data Model

### Fact Table

`fact_shipment`

- shipment_id
- booking_no
- job_no
- shipment_date
- year
- quarter
- month
- shipper
- sale_name
- carrier
- liner
- pol
- pod
- destination
- country
- trade
- qty
- unit
- teu
- status

### Date Dimension

`dim_date`

- date
- day
- month
- month_name
- quarter
- year
- year_month
- year_quarter

## If Full Tracking Is Needed Later

Current file is not enough for true milestone tracking. Add these fields:

- shipment_id
- container_no
- ETD
- ETA
- ATD
- ATA
- current_location
- current_milestone
- last_event_time
- delay_days
- delay_reason
- on_time_flag

Then create:

`fact_shipment_event`

- shipment_id
- event_time
- event_type
- event_status
- location
- milestone_sequence

## Graph Mapping

- Line + bar combo: shipments and TEU by month / quarter / year
- Donut: trade mix
- Horizontal ranking: carrier, destination, shipper, route
- Status table or bar: shipment count by status
- Detail table: latest shipment rows after filtering

## Design Notes

- Current dataset is strongest for periodic volume analysis, not real-time tracking.
- Keep period filters global at the top of the page.
- Keep shipment detail always visible as the operational drill-down layer.
- When event-level data exists, add a second page for milestone tracking and exceptions.
