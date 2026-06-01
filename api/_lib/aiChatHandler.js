import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";
import { requireSession as defaultRequireSession } from "./authHandlers.js";
import { createAiChatResponse, AiChatConfigError, AiChatValidationError } from "./aiChatService.js";
import { scopeWorkbookDataForUser } from "./shipmentHandlers.js";
import { loadWorkbookData as defaultLoadWorkbookData } from "./workbook.js";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimits = new Map();

export async function aiChatHandler(req, res, deps = {}) {
  if (req.method !== "POST") return sendMethodNotAllowed(res, ["POST"]);

  const requireSession = deps.requireSession || defaultRequireSession;
  const session = await requireSession(req, res);
  if (!session) return null;

  if (!allowRequest(session.user?.id || session.user?.username || "anonymous")) {
    return sendJson(res, 429, { error: "Too many AI chat requests. Please try again shortly." });
  }

  const body = getRequestBody(req);
  const loadWorkbookData = deps.loadWorkbookData || defaultLoadWorkbookData;

  try {
    const result = await createAiChatResponse({
      messages: body.messages,
      filters: body.filters,
      pageContext: body.pageContext,
      openAIClient: deps.openAIClient,
      loadWorkbookData: async () => scopeWorkbookDataForUser(await loadWorkbookData(), session.user),
      model: deps.model,
      maxRows: deps.maxRows,
      maxMessages: deps.maxMessages,
    });

    return sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof AiChatValidationError || error instanceof AiChatConfigError) {
      return sendJson(res, error.status, { error: error.message });
    }

    return sendJson(res, 500, { error: "Unable to generate AI response" });
  }
}

function allowRequest(key) {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || now - current.startedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
}
