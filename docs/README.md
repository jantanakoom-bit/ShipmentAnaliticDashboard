# Shipment Analytics Dashboard — Documentation

## Active Docs

| File                                                       | Purpose                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| [architecture.md](architecture.md)                         | System architecture, data flow, component structure                     |
| [api-reference.md](api-reference.md)                       | REST API endpoints, request/response, auth                              |
| [data-contract.md](data-contract.md)                       | Google Sheets tabs, required columns, optional tracking columns         |
| [operational-tracking.md](operational-tracking.md)         | Tracking page behavior, exception rules, and workflow notes             |
| [ai-chat-system-design.md](ai-chat-system-design.md)       | AI chat architecture using OpenAI SDK and workbook data tools           |
| [deployment.md](deployment.md)                             | Local dev, Docker, CI/CD, environment setup                             |
| [testing.md](testing.md)                                   | Unit, API, build, and E2E verification strategy                         |
| [rbac-sales-crud-pr-notes.md](rbac-sales-crud-pr-notes.md) | Branch review notes for RBAC Sales CRUD and Google Sheet schema changes |
| [update-docs-plan.html](update-docs-plan.html)             | Git-backed plan for synchronizing docs with the current branch          |

## Design Reference

| File                 | Purpose                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| [mockups/](mockups/) | HTML mockups for the original 5 pages (login, dashboard, analytics, shipments, admin) |

## Archive

| File                                              | Why Archived                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `archive/dashboard-design.md`                     | Pre-implementation design doc — references Excel as data source; project now uses Google Sheets |
| `archive/frontend-backend-api-e2e-test-plan.html` | Original test plan HTML; test suite is now in `tests/` and described in `testing.md`            |
| `archive/devops.md`                               | Earlier deployment notes superseded by `deployment.md`                                          |
