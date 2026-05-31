# Architecture

## Overview

Single-page React app with an Express API backend. Data lives in Google Sheets — no database server.

```
Browser (React SPA)
  │
  ├── /api/* → Express API (port 3001)
  │               ├── auth/        (login, logout, session)
  │               ├── admin/users/ (CRUD, admin only)
  │               └── workbook     (shipment data)
  │                   │
  │                   └── Google Sheets API
  │                       ├── "Detail Data" sheet → shipment rows
  │                       └── "Users" sheet       → user credentials
  │
  └── Vite dev server (port 5173) → proxies /api to :3001
```

In production, nginx serves the static frontend and proxies `/api` to the Express backend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Recharts, React Router 7, Vite 7 |
| Styling | Custom CSS (DM Sans + IBM Plex Mono) |
| Backend | Express 5, session-based JWT auth (jose + bcryptjs) |
| Data | Google Sheets API via googleapis |
| Testing | Vitest (unit/API), Playwright (E2E) |
| CI | GitHub Actions — lint, test, build, E2E |
| Deploy | Docker (nginx frontend, optional Express backend) |

## Frontend Structure

```
src/
├── main.jsx              # Entry point — BrowserRouter wrapper
├── App.jsx               # Orchestrator — state management, data loading, AppShell
├── components/
│   ├── LoginScreen.jsx   # Auth form
│   ├── NavSidebar.jsx    # Collapsible sidebar with nav + filters
│   ├── ChipMultiSelect.jsx      # Year/Quarter chip filter
│   ├── SearchableMultiSelect.jsx # Port/Country/Trade/Carrier/Sale filter
│   ├── KpiCard.jsx        # Dashboard KPI card
│   ├── OverviewKpis.jsx   # Dashboard KPI grid
│   ├── InsightTile.jsx    # Dashboard insight tile
│   ├── ChartCard.jsx      # Chart container with title
│   ├── DetailKpi.jsx      # Analytics KPI card
│   ├── DetailAnalysis.jsx # Analytics detail view
│   ├── TabPanel.jsx       # Tabbed content panel
│   ├── ShipmentTable.jsx  # Data table with sort/pagination
│   ├── TopListCard.jsx    # Top-N ranking card
│   ├── TopRankings.jsx    # Ranking list component
│   └── AdminUsers.jsx     # Admin user management
├── pages/
│   ├── DashboardPage.jsx  # / — KPIs, charts, insights, nav cards
│   ├── AnalyticsPage.jsx  # /analytics — filter summary, detail KPIs, charts, rankings
│   ├── ShipmentsPage.jsx  # /shipments — searchable sortable paginated table
│   └── AdminPage.jsx      # /admin — user CRUD
├── lib/
│   ├── dashboard.js       # Data transforms (buildFilterOptions, etc.)
│   ├── loadWorkbook.js    # Fetch /api/workbook and parse
│   ├── api.js             # apiRequest helper
│   ├── constants.js       # MONTH_LABELS, CHART_COLORS
│   └── utils.js           # Pure data utilities (filter, sort, aggregate)
└── styles.css             # Global styles
```

## Data Flow

```
1. User logs in
   → POST /api/auth/login
   → Express validates against "Users" sheet in Google Sheets
   → Returns JWT session cookie

2. App loads data
   → GET /api/workbook
   → Express reads "Detail Data" sheet via Google Sheets API
   → Returns { metadata, detailData: [...] }

3. Frontend transforms data
   → dashboard.js: buildFilterOptions, getCounts
   → utils.js: filterByDate, filterByMultiSelect, topGroup, buildMonthlySeries

4. Components render
   → App.jsx owns all state (filters, selections, computed data)
   → Passes derived data as props to page components
   → Pages are stateless — they receive data and render
```

## State Management

No external state library. App.jsx is the single state owner:

| State | Purpose |
|-------|---------|
| `state` | Loading, error, metadata, detailData, filterOptions, counts |
| `isAuthenticated` / `currentUser` | Auth state |
| `dateFilters` | Year/quarter/month selections |
| `selected` | Port/country/trade/carrier/sales selections |
| `searches` | Search text for each multi-select filter |

Derived data is computed with `useMemo` — `filteredRows`, `topPort`, `topCarrier`, etc.

## Routing

| Path | Page | Sidebar Mode |
|------|------|-------------|
| `/` | Dashboard | compact (year + quarter filters) |
| `/analytics` | Analytics | full (all filters) |
| `/shipments` | Shipments | full (all filters) |
| `/admin` | Admin | nav (no filters) |

## Authentication

- Session-based JWT stored in httpOnly cookie (XSS-safe)
- Passwords hashed with bcryptjs
- Google Sheets "Users" tab as the user store
- Admin role required for user management endpoints
