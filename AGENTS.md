# Repository Guidelines

## Instruction Priority
Follow system/developer instructions first, then explicit user requests, then this file. Preserve user work in a dirty worktree: do not revert, overwrite, or reformat unrelated changes. Read relevant files before editing, keep changes scoped, and prefer existing project patterns over new abstractions.

## Project Structure & Module Organization
This is a Vite + React dashboard with Express/Vercel API handlers backed by Google Sheets. The frontend lives in `src/`: `App.jsx` owns the main shell/state, `main.jsx` boots the app, `components/` contains reusable UI, `pages/` contains route views, `styles.css` holds global styling, and `src/lib/` contains workbook parsing, API helpers, and dashboard/tracking transforms. Backend entrypoints are `server.js` for local Express development and `api/` for Vercel-style route handlers, with shared server utilities in `api/_lib/`. E2E tests live in `tests/e2e/`, scripts in `scripts/`, static assets and workbook inputs in `public/`, generated build output in `dist/`, and operational notes in `docs/`.

## Build, Test, and Development Commands
Use `npm install` once to install dependencies. Run `npm run dev` for the Vite frontend and `npm run dev:server` in a second terminal for the Express API on port `3001`; the frontend dev server proxies `/api` to the backend. Create a production bundle with `npm run build`, then validate it locally with `npm run preview`. Run unit and API tests with `npm test`, or target layers with `npm run test:unit` and `npm run test:api`. Run browser coverage with `npm run test:e2e`. Generate password hashes through stdin with `read -s PASSWORD && printf '%s\n' "$PASSWORD" | npm run hash-password -- --stdin; unset PASSWORD`. For container work, use `docker compose up --build frontend` or `docker compose --profile backend up --build`.

## Verification Expectations
Use the narrowest check that proves the change, then broaden when shared behavior, auth, API contracts, data transforms, or user-facing flows are touched. The normal full gate is `npm test` -> `npm run build` -> `npm run test:e2e`. ESLint is configured in `eslint.config.js`; when lint behavior matters, run `npx eslint .` because there is no package script for it. For dashboard KPI changes, derive expected values from fixtures instead of hardcoding totals. For API changes, include `/api/health` and the affected authenticated endpoints in smoke coverage when practical.

## Coding Style & Naming Conventions
Use JavaScript ES modules with 2-space indentation, semicolons, and double quotes. React components use PascalCase (`AdminUsers`, `ChartCard`); hooks, helpers, and utility modules use camelCase (`loadWorkbookData`, `buildFilterOptions`). Keep shared parsing and data-shaping logic in `src/lib/` or `api/_lib/` instead of expanding `App.jsx`, page components, or route files. Prefer structured parsers and existing helpers over ad hoc string manipulation. Avoid inline styles and committed debug output; use `src/styles.css` and remove temporary `console.log` calls.

## Testing Guidelines
Vitest covers frontend units and API helpers; Playwright covers E2E flows. Place frontend tests beside the feature or under `src/`, and name them `*.test.jsx` or `*.test.js`. Place browser specs under `tests/e2e/` as `*.spec.js`. Prefer deterministic fixtures and browser/API mocks for workbook and Google Sheets dependent flows. When a test fails, treat it as evidence and diagnose the relevant path before changing unrelated code.

## Security & Data Protection
Copy `.env.example` to `.env` for local setup and never commit secrets. Do not print, summarize, copy, or log secret values from `.env`, Google service account files, private keys, tokens, or deployment configs. Frontend-exposed values must use the `VITE_` prefix. Treat Google Sheets credentials, generated password hashes, session secrets, OpenAI keys, and sheet IDs as sensitive operational data. Auth, sessions, RBAC, Google Sheets write-back, AI chat, and shipment CRUD are shared trust boundaries; make reversible, narrow changes and verify carefully.

## Repo Workflow
Before editing, check the current worktree when relevant and inspect the nearby implementation, tests, and docs. Use `rg`/`rg --files` for local search. Use `apply_patch` for manual text edits. Do not modify generated, vendored, lock, or binary files unless the task requires it. Do not create commits, branches, destructive git changes, migrations, or broad file operations unless explicitly requested. If hooks block a command, treat the block as evidence and choose a safer command.

## Frontend and UX Rules
Match the existing dashboard design system and CSS conventions. Keep operational dashboard screens dense, scannable, and work-focused rather than marketing-style. Verify responsive behavior for user-facing UI changes, especially tables, filters, navigation, forms, and shipment CRUD pages. Use existing component patterns and page layout before adding new UI primitives.

## API and Data Contract Rules
Google Sheets is both the shipment data source and user store. Preserve documented sheet names, headers, optional tracking columns, and RBAC Sales CRUD fields described in `README.md` and `docs/data-contract.md`. Shipment CRUD uses `Detail Data` rows as sales records: normal `user` accounts are owner-scoped, `moderator` can manage shipment records but not user/system settings, and `admin` keeps user-management access. Keep auth and permission checks server-side.

## Commit & Pull Request Guidelines
The visible history is minimal, so keep commit messages short, imperative, and specific, for example `Add admin user status toggle`. Keep unrelated changes out of the same commit. PRs should include a concise summary, environment or data prerequisites, linked issue references, screenshots for dashboard UI changes, and exact verification commands/results.

## Final Response Expectations
For completed work, state what changed, link changed files when useful, and list exact verification commands with meaningful output summaries. Mention skipped checks, hook blocks, unresolved risks, assumptions, or existing dirty-worktree files when relevant. Keep the response concise and BLUF-first.
