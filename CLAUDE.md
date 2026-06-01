# Shipment Analytic Dashboard

Shipment analytics and operational tracking dashboard — React frontend + Vercel Serverless Functions, backed by Google Sheets as the data source and user store.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Recharts, custom CSS (DM Sans + IBM Plex Mono) |
| Backend | Vercel Serverless Functions (Express-compatible req/res) + local Express dev server |
| Auth | Session-based JWT (jose + bcryptjs), HttpOnly cookies |
| Data | Google Sheets API (googleapis) — shipment data, tracking fields, user credentials |
| AI | OpenAI SDK behind authenticated `/api/chat` |
| Build | Vite 7 |
| Test | Vitest 4 (unit + API) · Playwright 1.60 (E2E) |
| CI | GitHub Actions — lint, unit/API, build, E2E |
| Deploy | Vercel (primary) · Docker (alternative) |

## Commands

```bash
npm install              # install deps
npm run dev              # Vite dev server (port 5173, proxies /api → :3001)
npm run dev:server       # Express API (port 3001) — local dev only
npm run build            # production build → dist/
npm test                 # unit + API tests (vitest)
npm run test:e2e         # E2E tests (Playwright, chromium)
read -s PASSWORD && printf '%s\n' "$PASSWORD" | npm run hash-password -- --stdin; unset PASSWORD
vercel                   # deploy to Vercel
vercel --prod            # deploy to production
```

Two terminals needed for local dev: `npm run dev` + `npm run dev:server`.

## Project Structure

```
├── api/                  # Vercel Serverless Functions (auto-routed)
│   ├── _lib/             # shared helpers (excluded from routing by _ prefix)
│   │   ├── createApp.js  # Express factory (local dev only)
│   │   ├── authHandlers.js, adminHandlers.js
│   │   ├── googleSheets.js, session.js, http.js, users.js
│   │   ├── workbook.js   # data loading, filtering, analytics
│   │   ├── tracking.js, trackingHandlers.js
│   │   └── aiChat*.js    # chat handler, service, prompts, tools
│   ├── auth/             # login, logout, session endpoints
│   ├── admin/users/      # admin user CRUD (REST)
│   ├── health.js         # GET /api/health
│   ├── workbook.js       # GET /api/workbook
│   ├── metadata.js       # GET /api/metadata
│   ├── shipments.js      # GET /api/shipments
│   ├── analytics.js      # GET /api/analytics
│   ├── tracking.js       # GET /api/tracking
│   ├── tracking/         # GET /api/tracking/exceptions
│   └── chat.js           # POST /api/chat
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── pages/            # page components (lazy-loaded)
│   └── lib/              # dashboard.js, tracking.js, aiChat.js, loadWorkbook.js, api.js, constants.js, utils.js
├── tests/e2e/            # Playwright specs
├── scripts/              # hash-password utility
├── docs/                 # architecture, API, data contract, tracking, AI chat, deployment, testing
├── server.js             # Express entry point (local dev only)
├── vercel.json           # Vercel config — build, output, SPA rewrites
├── vite.config.js        # Vite + Vitest config, dev proxy
├── docker-compose.yml    # Docker orchestration (alternative deploy)
├── Dockerfile            # Multi-stage build (alternative deploy)
└── .github/workflows/    # CI pipeline (tests.yml)
```

## Architecture

- **App.jsx** is the orchestrator — owns all state, delegates rendering to components
- **api/** contains Vercel Serverless Functions — each file is an independent endpoint
- **api/_lib/** contains shared logic (excluded from routing by `_` prefix)
- **api/_lib/createApp.js** + **server.js** provide Express for local development only
- **Google Sheets** serves dual purpose: user authentication table + shipment data source
- **Operational tracking** is derived from optional fields on the same `Detail Data` rows
- **AI chat** runs through backend tools only; OpenAI keys never reach the browser
- **Vite dev proxy** routes `/api` to Express in development
- **Pages are lazy-loaded** via `React.lazy` — AnalyticsPage (Recharts) loads on demand

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Session login |
| POST | `/api/auth/logout` | Session logout |
| GET | `/api/auth/session` | Session status |
| GET | `/api/workbook` | Full shipment data (authenticated) |
| GET | `/api/metadata` | Data source metadata (authenticated) |
| GET | `/api/shipments` | Filtered shipments with pagination (authenticated) |
| GET | `/api/analytics` | Aggregated analytics (authenticated) |
| GET | `/api/tracking` | Tracking milestones, summary, exceptions (authenticated) |
| GET | `/api/tracking/exceptions` | Exception-only tracking queue (authenticated) |
| POST | `/api/chat` | AI shipment assistant (authenticated, OpenAI configured) |
| GET | `/api/admin/users` | List users (admin) |
| POST | `/api/admin/users` | Create user (admin) |
| PATCH | `/api/admin/users/:id` | Update user (admin) |

## Data Flow

1. User logs in → Express validates against Google Sheets `Users` tab
2. Frontend fetches `/api/workbook` → API reads `Detail Data` sheet
3. `dashboard.js` transforms rows into KPIs, charts, rankings, filters
4. `tracking.js` derives milestones and exception queues from optional tracking fields
5. `/api/chat` uses backend tools to query capped workbook summaries for OpenAI
6. Components render via props from App.jsx state

## Coding Conventions

- JavaScript (ES modules), no TypeScript
- 2-space indent, semicolons, double quotes
- React components: PascalCase files and exports
- Utilities/hooks: camelCase
- Shared logic in `src/lib/` or `api/_lib/` — not in components or routes
- No inline styles — use `src/styles.css`
- No `console.log` in committed code

## Testing

- **Unit tests:** `src/lib/*.test.js` — data transforms, workbook parsing, tracking view model
- **API tests:** `api/_lib/*.test.js` — auth, health, workbook, tracking, AI tools
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

## Vercel Deployment

```bash
# First-time setup
npm i -g vercel
vercel login

# Deploy (preview)
vercel

# Deploy (production)
vercel --prod
```

### Required Vercel Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | JWT signing key (min 32 chars) |
| `CORS_ORIGIN` | Optional comma-separated allowlist; production defaults to same-origin |
| `LOGIN_THROTTLE_MAX_FAILURES` | Optional failed login limit, default `5` |
| `LOGIN_THROTTLE_WINDOW_MS` | Optional failed login window, default `900000` |
| `LOGIN_LOCKOUT_MS` | Optional login lockout duration, default `900000` |
| `GOOGLE_SHEET_ID` | Google Sheets spreadsheet ID |
| `GOOGLE_CLIENT_EMAIL` | Service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key (full PEM) |
| `USER_SHEET_NAME` | Users tab name (default: `Users`) |
| `DATA_SHEET_NAME` | Data tab name (default: `Detail Data`) |
| `WORKBOOK_MAX_ROWS` | Optional max shipment data rows, default `10000` |
| `WORKBOOK_MAX_COLUMNS` | Optional max shipment sheet columns, default `128` |
| `VITE_API_BASE_URL` | Set to `/api` (same-origin) |
| `OPENAI_API_KEY` | Enables AI chat |
| `OPENAI_MODEL` | Optional AI model override |
| `AI_CHAT_MAX_MESSAGES` | Optional chat history cap |
| `AI_CHAT_MAX_ROWS` | Optional workbook row cap for AI tools |

### Vercel Configuration (`vercel.json`)

- **Build command:** `npm run build` (Vite)
- **Output directory:** `dist/`
- **SPA rewrites:** all non-`/api/` routes → `index.html`
- **API:** auto-detected from `api/` directory (files = endpoints)

### Notes

- `api/_lib/` is ignored by Vercel ( `_` prefix) — serves as shared helpers
- In-memory cache in workbook.js is best-effort on serverless (persists on warm instances, resets on cold starts)
- `server.js` and `createApp.js` are for local Express development only — not used by Vercel

## Current Scope

- Loads shipment detail data from Google Sheets
- Period filters: month, quarter, year
- Dashboard: KPIs, TEU trends, top trade/carrier/destination/shipper/route
- Shipment detail drill-down table
- Operational tracking: milestones, exception queue, delayed/stale/missing/invalid checks
- AI chat assistant with authenticated backend tools
- Admin user management
- Auth with Google Sheets user store
