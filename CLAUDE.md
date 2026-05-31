# Shipment Analytic Dashboard

Shipment analytics dashboard — React frontend + Express API, backed by Google Sheets as the data source and user store.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Recharts, custom CSS (DM Sans + IBM Plex Mono) |
| Backend | Express 5, session-based JWT auth (jose + bcryptjs) |
| Data | Google Sheets API (googleapis) — shipment data + user credentials |
| Build | Vite 7 |
| Test | Vitest 4 (unit + API) · Playwright 1.60 (E2E) |
| CI | GitHub Actions — lint, unit/API, build, E2E |
| Deploy | Docker (nginx frontend, optional Express backend) |

## Commands

```bash
npm install              # install deps
npm run dev              # Vite dev server (port 5173, proxies /api → :3001)
npm run dev:server       # Express API (port 3001)
npm run build            # production build → dist/
npm test                 # unit + API tests (vitest)
npm run test:e2e         # E2E tests (Playwright, chromium)
npm run hash-password -- <pw>  # generate bcrypt hash for user setup
```

Two terminals needed for local dev: `npm run dev` + `npm run dev:server`.

## Project Structure

```
├── api/                  # Express API
│   ├── _lib/             # createApp factory, auth, googleSheets, session, users, workbook
│   ├── auth/             # login, logout, session endpoints
│   ├── admin/users/      # admin user CRUD (REST)
│   └── workbook.js       # GET /api/workbook — shipment data
├── src/                  # React frontend
│   ├── components/       # UI components (14 files, decomposed from monolith)
│   │   ├── LoginScreen.jsx, Sidebar.jsx, HeroPanel.jsx
│   │   ├── KpiCard.jsx, OverviewKpis.jsx, InsightTile.jsx
│   │   ├── ChartCard.jsx, DetailAnalysis.jsx, DetailKpi.jsx
│   │   ├── ShipmentTable.jsx, TopListCard.jsx, TopRankings.jsx
│   │   ├── AdminUsers.jsx, SearchableMultiSelect.jsx, ChipMultiSelect.jsx
│   └── lib/              # dashboard.js (transforms), loadWorkbook.js, api.js, constants.js, utils.js
│   ├── styles.css        # global styles
│   ├── App.jsx           # orchestrator — state management, routing, layout
│   └── main.jsx          # entry point
├── tests/e2e/            # Playwright specs
├── scripts/              # hash-password utility
├── docs/                 # design reference, devops guide, test plan
├── server.js             # Express entry point
├── vite.config.js        # Vite + Vitest config, dev proxy
├── docker-compose.yml    # Docker orchestration
├── Dockerfile            # Multi-stage build (node → nginx)
└── .github/workflows/    # CI pipeline (tests.yml)
```

## Architecture

- **App.jsx** is the orchestrator — owns all state, delegates rendering to components
- **api/_lib/createApp.js** is the Express factory — composes middleware, auth, routes
- **Google Sheets** serves dual purpose: user authentication table + shipment data source
- **Vite dev proxy** routes `/api` to Express in development; nginx handles this in production

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Session login |
| POST | `/api/auth/logout` | Session logout |
| GET | `/api/auth/session` | Session status |
| GET | `/api/workbook` | Shipment data |
| GET | `/api/admin/users` | List users (admin) |
| POST | `/api/admin/users` | Create user (admin) |
| PATCH | `/api/admin/users/:id` | Update user (admin) |

## Data Flow

1. User logs in → Express validates against Google Sheets `Users` tab
2. Frontend fetches `/api/workbook` → Express reads `Detail Data` sheet
3. `dashboard.js` transforms raw rows into KPIs, charts, rankings, filters
4. Components render via props from App.jsx state

## Coding Conventions

- JavaScript (ES modules), no TypeScript
- 2-space indent, semicolons, double quotes
- React components: PascalCase files and exports
- Utilities/hooks: camelCase
- Shared logic in `src/lib/` or `api/_lib/` — not in components or routes
- No inline styles — use `src/styles.css`
- No `console.log` in committed code

## Testing

- **Unit tests:** `src/lib/*.test.js` — data transforms, workbook parsing
- **API tests:** `api/_lib/*.test.js` — auth, health, workbook endpoints
- **E2E tests:** `tests/e2e/*.spec.js` — Playwright, chromium only
- Test runner: Vitest for unit/API, Playwright for E2E
- CI runs all three layers: `npm test` → `npm run build` → `npm run test:e2e`

## Security

- `.env` holds secrets (SESSION_SECRET, Google service account key) — never commit
- Frontend env vars must use `VITE_` prefix
- Passwords hashed with bcryptjs — use `npm run hash-password`
- Session auth via signed cookies (jose JWT)
- Google service account JSON is gitignored

## Agent Routing

| Task | Agent |
|------|-------|
| Implement features, fix bugs | `coder` |
| Pre-commit review | `reviewer` |
| Run tests, coverage | `tester` |
| Debug auth/API/Sheets issues | `trace-analyzer` |
| Google Sheets API changes | `integration-eng` |
| Docker/CI updates | `devops-engineer` |
| Dashboard responsive/a11y | `ux-reviewer` |

## Environment Setup

```bash
cp .env.example .env
# Fill in: SESSION_SECRET, Google Sheets credentials, sheet IDs
npm install
npm run dev          # terminal 1
npm run dev:server   # terminal 2
```

## Current Scope

- Loads shipment detail data from Google Sheets
- Period filters: month, quarter, year
- Dashboard: KPIs, TEU trends, top trade/carrier/destination/shipper/route
- Shipment detail drill-down table
- Admin user management
- Auth with Google Sheets user store
