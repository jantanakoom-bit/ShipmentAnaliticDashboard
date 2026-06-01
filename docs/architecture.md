# Architecture

## Overview

Single-page React app with Vercel-style API handlers and a local Express dev server. Data lives in Google Sheets; there is no database server.

```
Browser (React SPA)
  │
  ├── /api/* → Vercel API handlers or local Express API (port 3001)
  │               ├── auth/        (login, logout, session)
  │               ├── admin/users/ (CRUD, admin only)
  │               ├── workbook     (shipment data)
  │               ├── analytics    (aggregated metrics)
  │               ├── shipments    (filtered row access)
  │               ├── tracking     (milestones + exceptions)
  │               └── chat         (OpenAI-backed shipment assistant)
  │                   │
  │                   └── Google Sheets API
  │                       ├── "Detail Data" sheet → shipment rows
  │                       └── "Users" sheet       → user credentials
  │
  └── Vite dev server (port 5173) → proxies /api to :3001
```

In Vercel production, `api/` files are deployed as serverless functions and non-API routes are rewritten to the Vite SPA. Docker remains an alternate deployment path with nginx serving `dist/` and proxying `/api` to Express.

## Tech Stack

| Layer    | Technology                                                                                |
| -------- | ----------------------------------------------------------------------------------------- |
| Frontend | React 19, Recharts, React Router 7, Vite 7                                                |
| Styling  | Custom CSS (DM Sans + IBM Plex Mono)                                                      |
| Backend  | Vercel API handlers, local Express 5 dev server, session-based JWT auth (jose + bcryptjs) |
| Data     | Google Sheets API via googleapis                                                          |
| Testing  | Vitest (unit/API), Playwright (E2E)                                                       |
| CI       | GitHub Actions — lint, test, build, E2E                                                   |
| Deploy   | Vercel primary, Docker alternate                                                          |

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
│   ├── AiChatDrawer.jsx   # Authenticated AI assistant drawer
│   ├── MarkdownMessage.jsx # Chat message renderer
│   ├── DetailKpi.jsx      # Analytics KPI card
│   ├── TabPanel.jsx       # Tabbed content panel
│   ├── ShipmentTable.jsx  # Data table with sort/pagination
│   ├── TopListCard.jsx    # Top-N ranking card
│   ├── TopRankings.jsx    # Ranking list component
│   └── AdminUsers.jsx     # Admin user management
├── pages/
│   ├── DashboardPage.jsx  # / — KPIs, charts, insights, nav cards
│   ├── AnalyticsPage.jsx  # /analytics — filter summary, detail KPIs, charts, rankings
│   ├── ShipmentsPage.jsx  # /shipments — table, inline create form, modal detail/edit/delete flow
│   ├── TrackingPage.jsx   # /tracking — milestones, exception queue
│   └── AdminPage.jsx      # /admin — user CRUD
├── lib/
│   ├── dashboard.js       # Data transforms (buildFilterOptions, etc.)
│   ├── loadWorkbook.js    # Fetch /api/workbook and parse
│   ├── tracking.js        # Tracking view model and exception filters
│   ├── aiChat.js          # POST /api/chat helper
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
   → tracking.js: buildTrackingViewModel, filterTrackingRows

4. Components render
   → App.jsx owns all state (filters, selections, computed data)
   → Passes derived data as props to page components
   → Pages are stateless — they receive data and render
```

Shipment CRUD writes use the authenticated API instead of mutating browser state directly. The Shipments page keeps creation inline, opens existing rows in a detail dialog, and requires confirmation before calling the soft-delete endpoint.

## State Management

No external state library. App.jsx is the single state owner:

| State                             | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `state`                           | Loading, error, metadata, detailData, filterOptions, counts |
| `isAuthenticated` / `currentUser` | Auth state                                                  |
| `dateFilters`                     | Year/quarter/month selections                               |
| `selected`                        | Port/country/trade/carrier/sales selections                 |
| `searches`                        | Search text for each multi-select filter                    |

Derived data is computed with `useMemo` — `filteredRows`, `topPort`, `topCarrier`, etc.

Tracking data is derived from the same filtered shipment rows. Optional operational fields are normalized by `api/_lib/workbook.js`; missing tracking fields remain compatible and become tracking exceptions where appropriate.

AI chat data access is backend-owned. The browser sends messages, filters, and page context to `/api/chat`; backend tools read the same normalized workbook data and return capped, projected results to the model.

## Routing

| Path         | Page      | Sidebar Mode                     |
| ------------ | --------- | -------------------------------- |
| `/`          | Dashboard | compact (year + quarter filters) |
| `/analytics` | Analytics | full (all filters)               |
| `/shipments` | Shipments | full (all filters)               |
| `/tracking`  | Tracking  | full (all filters)               |
| `/admin`     | Admin     | nav (no filters)                 |

## Authentication

- Session-based JWT stored in httpOnly cookie (XSS-safe)
- Passwords hashed with bcryptjs
- Google Sheets "Users" tab as the user store
- Admin role required for user management endpoints
