# AI Chat System Design

## Current Status

AI chat is implemented as an authenticated shipment analytics assistant. The browser sends messages, current filters, and page context to `POST /api/chat`. The backend owns OpenAI access and workbook data tools.

The browser never receives `OPENAI_API_KEY`.

## Request Flow

```
Browser AiChatDrawer
  |
  | POST /api/chat
  v
api/chat.js or local Express route
  |
  +-- requireSession()
  +-- createAiChatResponse()
        |
        +-- OpenAI Responses API
        +-- deterministic workbook tools
              |
              +-- loadWorkbookData()
              +-- filterRows()
              +-- buildAnalytics()
              +-- projectShipmentRow()
```

## Backend Files

| File | Responsibility |
|------|----------------|
| `api/chat.js` | Vercel API handler |
| `api/_lib/aiChatHandler.js` | Method, auth, body handling |
| `api/_lib/aiChatService.js` | OpenAI Responses API orchestration and tool loop |
| `api/_lib/aiChatTools.js` | Safe deterministic workbook tools |
| `api/_lib/aiChatPrompts.js` | Assistant instructions and metric glossary |
| `api/_lib/createApp.js` | Registers `/api/chat` for local Express development |

## Frontend Files

| File | Responsibility |
|------|----------------|
| `src/components/AiChatDrawer.jsx` | Drawer UI, message state, loading/error states |
| `src/components/MarkdownMessage.jsx` | Safe Markdown rendering |
| `src/lib/aiChat.js` | `POST /api/chat` helper |
| `src/App.jsx` | Passes active filters and page context into the drawer |

## API Contract

### POST /api/chat

**Auth:** Required session cookie.

**Request:**

```json
{
  "messages": [
    { "role": "user", "content": "Top carriers by TEU this year?" }
  ],
  "filters": {
    "years": ["2026"],
    "quarters": ["Q1"],
    "months": ["1"],
    "trade": ["Asia"],
    "carrier": ["Carrier A"],
    "sales": ["Pan"]
  },
  "pageContext": {
    "route": "/analytics",
    "recordCount": 128
  }
}
```

**Response:**

```json
{
  "answer": "Carrier A leads the selected data with 420 TEU...",
  "dataUsed": {
    "filters": { "years": ["2026"], "carrier": ["Carrier A"] },
    "tools": ["get_shipment_summary"],
    "rowsMatched": 128,
    "rowLimitApplied": false
  },
  "requestId": "req_..."
}
```

**Errors:**

```json
{ "error": "Authentication required" }
{ "error": "AI chat is not configured" }
{ "error": "Message is required" }
{ "error": "Message is too long" }
{ "error": "Unable to generate AI response" }
```

## Tool Set

| Tool | Purpose | Guardrails |
|------|---------|------------|
| `get_metadata` | Returns workbook metadata, filters, date range, row count | No credentials or env values |
| `get_shipment_summary` | Returns aggregate shipment analytics | Uses filtered workbook rows; no raw full workbook dump |
| `search_shipments` | Returns capped shipment rows | Max `AI_CHAT_MAX_ROWS`; projects allowed fields only |
| `explain_metric` | Explains dashboard metric calculations | Static glossary only |

Allowed row fields for shipment search:

```text
date, bookingNo, jobNo, shipper, pol, pod, country, port, destination,
qty, unit, teu, status, saleName, trade, carrier, route
```

## Security Rules

- `OPENAI_API_KEY` is server-only.
- `/api/chat` requires an authenticated session.
- Tool handlers decide what data can be accessed; the model cannot access Google Sheets directly.
- Row output is capped.
- Hidden instructions, env values, cookies, and credentials must never be passed to the model.
- The assistant must say when ETA, delay causes, cost, or other unsupported fields are unavailable.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enables AI chat |
| `OPENAI_MODEL` | Optional model override |
| `AI_CHAT_MAX_MESSAGES` | Optional message history cap; default is 12 |
| `AI_CHAT_MAX_ROWS` | Optional row output cap; default is 50 |

## Current Limits

- No response streaming.
- No saved chat sessions.
- No tracking-specific tools yet.
- No admin/user-management tools.
- No vector store or file-search integration.

## Recommended Next Iteration

1. Add tracking-specific tools such as `get_tracking_exceptions`.
2. Add basic request logging with request ID and latency, without logging prompts or full answers by default.
3. Add streaming only after the synchronous tool path remains stable in production.
