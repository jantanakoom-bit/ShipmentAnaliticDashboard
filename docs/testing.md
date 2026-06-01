# Testing

## Purpose

The project uses deterministic local tests for dashboard transforms, API handlers, and browser workflows. Live Google Sheets access is not required for the default test stack.

## Test Commands

| Command             | Scope                                                     |
| ------------------- | --------------------------------------------------------- |
| `npm run test:unit` | React components and frontend data utilities under `src/` |
| `npm run test:api`  | API handlers and shared backend utilities under `api/`    |
| `npm test`          | Unit + API suites                                         |
| `npm run build`     | Production Vite bundle check                              |
| `npm run test:e2e`  | Playwright browser workflows                              |

Recommended verification before merging feature work:

```bash
npm test
npm run build
npm run test:e2e
```

## Test Layout

| Path                        | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `src/lib/*.test.js`         | Data transforms, workbook parsing, tracking view model      |
| `src/components/*.test.jsx` | Reusable UI component behavior                              |
| `src/pages/*.test.jsx`      | Page-level render behavior                                  |
| `api/_lib/*.test.js`        | Auth, workbook, tracking, AI tool, and Express app behavior |
| `tests/e2e/*.spec.js`       | Browser workflows with mocked API responses                 |
| `tests/e2e/helpers.js`      | Shared Playwright helpers and fixtures                      |

## Current Coverage Areas

| Area           | What is Checked                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Login, session handling, protected route behavior                                                                                  |
| Dashboard      | KPI values, filters, workbook load states                                                                                          |
| Analytics      | Chart and ranking pages with deterministic data                                                                                    |
| Shipments      | Table rendering, search, pagination-style workflows, create/update/delete, detail dialog, delete confirmation cancel/confirm paths |
| Tracking       | Milestone summaries, delayed/stale/missing/invalid exception states                                                                |
| Admin          | User list and admin-only workflows                                                                                                 |
| AI chat        | Authenticated chat shell and backend tool safety                                                                                   |
| Error states   | API failures, unauthenticated responses, controlled UI fallbacks                                                                   |

## Shipment CRUD Regression Focus

Shipment CRUD coverage should prove both RBAC behavior and the user workflow:

- Normal users can create owned rows and can update or soft-delete only accessible records.
- Moderators and admins can view all non-deleted sales records and can filter by salesperson.
- Legacy rows without durable ownership are visible to moderator/admin review paths, not normal user ownership paths.
- Existing rows open in a modal detail dialog for review and edits.
- Delete first opens a confirmation dialog; cancel keeps the detail dialog open and does not call the delete API.
- Confirm delete calls the soft-delete endpoint and removes the row from the active list after refresh.
- Delete failures stay visible in the confirmation flow so the user can retry or cancel.

Focused checks for this area:

```bash
npm run test:unit -- src/pages/pages.test.jsx
npm run test:e2e -- tests/e2e/shipments.spec.js
```

## E2E Notes

Playwright tests mock API responses in the browser where possible. This keeps CI deterministic and avoids requiring production Google Sheets credentials.

Use live Google Sheets checks only as a manual smoke test after environment variables are configured.

## Manual Smoke Checklist

1. Start local services:

```bash
npm run dev
npm run dev:server
```

2. Open `http://127.0.0.1:5173/`.
3. Sign in with a configured user.
4. Check dashboard load, filters, analytics, shipments, tracking, admin, and AI chat if `OPENAI_API_KEY` is set.
5. Confirm `/api/health` returns JSON from `http://localhost:3001/api/health`.

## Adding Tests

- Add pure transform tests close to the source module.
- Add API tests in `api/_lib/` when logic can run without network credentials.
- Add Playwright coverage for user-facing route behavior or regressions that are hard to prove with unit tests.
- Keep default tests independent of private Google Sheets data and external AI calls.
