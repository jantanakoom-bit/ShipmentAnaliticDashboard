# DevOps Guide

This project ships as a Vite/React frontend at the repository root plus an optional Express API in `server.js`.

## Prerequisites

- Node.js 22 or newer for local development and parity with the container build
- npm
- Docker Desktop or Docker Engine with Docker Compose v2

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server runs on the port printed by Vite, usually `http://localhost:5173`.

Run the API in a second terminal when you need backend endpoints:

```bash
npm run dev:server
```

The API listens on `http://localhost:3001` by default.

## Production Build Without Docker

```bash
npm ci
npm run build
npm run preview
```

`npm run build` writes static assets to `dist/`. `npm run preview` serves that build locally for a quick smoke test.

## Frontend Container

Build and run the production frontend container:

```bash
docker compose up --build frontend
```

Open `http://localhost:5173`. Change the host port by copying `.env.example` to `.env` and editing `FRONTEND_PORT`.

## Backend Profile

The backend service is disabled by default. Run both services with:

```bash
docker compose --profile backend up --build
```

The backend profile builds `Dockerfile.backend`, maps `${BACKEND_PORT:-3001}`, and passes `.env` values into the service.

## Environment Variables

Create a local `.env` from the template when you need non-default settings:

```bash
copy .env.example .env
```

Important variables:

- `FRONTEND_PORT`: host port for the nginx-served frontend container
- `BACKEND_PORT`: host and container port for the Express API
- `VITE_API_BASE_URL`: build-time API URL embedded by Vite
- `NODE_ENV`: runtime mode passed to the backend service

Vite only exposes variables prefixed with `VITE_` to frontend code. Rebuild the frontend image after changing `VITE_API_BASE_URL`.

## Operational Notes

- The frontend image builds with `npm ci` for lockfile-reproducible installs.
- The runtime image serves `dist/` with nginx on container port `80`.
- The backend image installs production dependencies only and serves `server.js`.
- `.dockerignore` excludes local dependencies, build output, logs, docs, and local env files from the Docker build context.
- Do not commit `.env`; commit only `.env.example`.

## Smoke Tests

```bash
npm run build
node server.js
docker compose config
docker compose up --build frontend
docker compose --profile backend up --build
```

Then verify `http://localhost:5173` loads the dashboard and the container is healthy:

```bash
docker compose ps
```

API smoke checks:

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/metadata
curl "http://localhost:3001/api/analytics?grain=quarter"
```
