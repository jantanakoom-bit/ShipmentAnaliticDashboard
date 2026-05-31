# Repository Guidelines

## Project Structure & Module Organization
The frontend lives at the repository root and is built with Vite + React. Main UI files are in `src/`: `App.jsx` contains the dashboard shell, `main.jsx` boots the app, `styles.css` holds global styling, and `src/lib/` contains workbook parsing, API helpers, and dashboard transforms. Backend entrypoints are `server.js` for local Express development and `api/` for route handlers, with shared server utilities in `api/_lib/`. Static assets and workbook inputs belong in `public/`. Build output is generated in `dist/`. Operational notes live in `docs/`.

## Build, Test, and Development Commands
Use `npm install` once to install dependencies. Run `npm run dev` for the Vite frontend and `npm run dev:server` in a second terminal for the Express API on port `3001`. Create a production bundle with `npm run build`, then validate it locally with `npm run preview`. For container work, use `docker compose up --build frontend` or `docker compose --profile backend up --build` for both services. Generate password hashes with `npm run hash-password -- <plain-text-password>`.

## Coding Style & Naming Conventions
Follow the existing JavaScript style: 2-space indentation, semicolons, double quotes, and ES modules. React components use PascalCase (`AdminUsers`, `ChartCard`); hooks, helpers, and utility modules use camelCase (`loadWorkbookData`, `buildFilterOptions`). Keep shared parsing and data-shaping logic in `src/lib/` or `api/_lib/` instead of expanding `App.jsx` or route files further.

## Testing Guidelines
There is no automated test suite configured yet. Before opening a PR, run `npm run build`, start the frontend and API locally, and smoke-test login, workbook loading, filters, and core API endpoints such as `/api/health` and `/api/metadata`. When adding tests later, place frontend tests beside the feature or under `src/__tests__/`, and name them `*.test.jsx` or `*.test.js`.

## Commit & Pull Request Guidelines
The visible history is minimal (`Initial commit`), so keep commit messages short, imperative, and specific, for example `Add admin user status toggle`. Keep unrelated changes out of the same commit. PRs should include a concise summary, any environment or data prerequisites, linked issue references, and screenshots for dashboard UI changes.

## Security & Configuration Tips
Copy `.env.example` to `.env` for local setup and never commit secrets. Frontend-exposed values must use the `VITE_` prefix. Treat Google Sheets credentials and generated password hashes as sensitive operational data.
