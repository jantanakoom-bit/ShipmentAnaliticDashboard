# Deployment Guide

## Prerequisites

- Node.js 22+
- npm
- Docker Desktop + Docker Compose v2 (for containerized deploy)
- Google Cloud service account JSON with Sheets API access

## Local Development

Two terminals required:

```bash
# Terminal 1 — Frontend (Vite dev server)
npm install
npm run dev          # http://localhost:5173, proxies /api → :3001

# Terminal 2 — Backend (Express API)
npm run dev:server   # http://localhost:3001
```

## Environment Setup

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | JWT signing key |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google service account email |
| `GOOGLE_PRIVATE_KEY` | Google service account private key |
| `GOOGLE_SHEET_ID` | Google Sheets spreadsheet ID |
| `PORT` | Express port (default: 3001) |

Frontend env vars must use `VITE_` prefix for Vite to expose them.

## Password Management

```bash
npm run hash-password -- <plaintext>
```

Paste the bcrypt hash into the Google Sheets "Users" tab.

## Production Build

```bash
npm ci
npm run build        # → dist/
npm run preview      # serve dist/ locally for smoke test
```

## Docker

### Frontend only (default)

```bash
docker compose up --build frontend
```

Open `http://localhost:5173`.

### Frontend + Backend

```bash
docker compose --profile backend up --build
```

The backend profile builds a separate Express container on port 3001.

### Port configuration

Copy `.env.example` to `.env` and set:

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_PORT` | 5173 | Host port for nginx frontend |
| `BACKEND_PORT` | 3001 | Host port for Express API |

Rebuild the frontend image after changing `VITE_API_BASE_URL`.

## Testing

```bash
npm test              # Unit + API tests (Vitest)
npm run test:e2e      # E2E tests (Playwright, chromium)
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/tests.yml`):

1. Install dependencies
2. Lint
3. Run unit/API tests (Vitest)
4. Build production bundle
5. Run E2E tests (Playwright)

## Smoke Tests After Deploy

```bash
# API health
curl http://localhost:3001/api/health

# Session check (requires cookie)
curl http://localhost:3001/api/auth/session

# Workbook data (requires auth)
curl http://localhost:3001/api/workbook
```

## Operational Notes

- Frontend image: `npm ci` → `npm run build` → nginx serves `dist/` on port 80
- Backend image: production deps only, serves `server.js`
- `.dockerignore` excludes `.env`, `node_modules`, `dist/`, `docs/`
- Never commit `.env` — only `.env.example`
