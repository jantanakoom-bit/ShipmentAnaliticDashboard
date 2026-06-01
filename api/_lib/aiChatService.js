import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { AI_CHAT_INSTRUCTIONS } from "./aiChatPrompts.js";
import { AI_CHAT_TOOL_DEFINITIONS, createChatToolRunner, DEFAULT_AI_CHAT_MAX_ROWS, normalizeFilterSnapshot } from "./aiChatTools.js";
import { loadWorkbookData as defaultLoadWorkbookData } from "./workbook.js";

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOOL_ROUNDS = 4;

let defaultOpenAIClient = null;

export async function createAiChatResponse({
  messages,
  filters = {},
  pageContext = {},
  conversationHistory = null,
  openAIClient,
  loadWorkbookData = defaultLoadWorkbookData,
  model = process.env.OPENAI_MODEL || DEFAULT_MODEL,
  maxRows = Number(process.env.AI_CHAT_MAX_ROWS) || DEFAULT_AI_CHAT_MAX_ROWS,
  maxMessages = Number(process.env.AI_CHAT_MAX_MESSAGES) || DEFAULT_MAX_MESSAGES,
} = {}) {
  const requestId = randomUUID();
  const normalizedMessages = normalizeMessages(messages, maxMessages);
  const client = openAIClient || getDefaultOpenAIClient();
  const runTool = createChatToolRunner({ loadWorkbookData, baseFilters: filters, maxRows });
  const input = buildInitialInput(normalizedMessages, filters, pageContext, conversationHistory);
  const toolsUsed = [];
  let rowsMatched = null;
  let rowLimitApplied = false;

  const createParams = {
    model,
    instructions: AI_CHAT_INSTRUCTIONS,
    input,
    tools: AI_CHAT_TOOL_DEFINITIONS,
  };

  if (conversationHistory?.previousResponseId) {
    createParams.previous_response_id = conversationHistory.previousResponseId;
  }

  let response;
  try {
    response = await client.responses.create(createParams);
  } catch {
    // If previous_response_id is rejected (expired), retry without it
    delete createParams.previous_response_id;
    response = await client.responses.create(createParams);
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = getFunctionCalls(response);
    if (!calls.length) {
      return {
        answer: response.output_text || extractText(response) || "I could not generate an answer.",
        dataUsed: {
          filters: normalizeFilterSnapshot(filters),
          tools: toolsUsed,
          rowsMatched,
          rowLimitApplied,
        },
        requestId,
        previousResponseId: response.id,
      };
    }

    const toolOutputs = [];
    for (const call of calls) {
      const args = parseToolArguments(call.arguments);
      const result = await runTool(call.name, args);
      toolsUsed.push(call.name);
      if (Number.isFinite(result.rowsMatched)) {
        rowsMatched = result.rowsMatched;
      }
      if (result.rowLimitApplied) {
        rowLimitApplied = true;
      }
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await client.responses.create({
      model,
      instructions: AI_CHAT_INSTRUCTIONS,
      input: toolOutputs,
      previous_response_id: response.id,
      tools: AI_CHAT_TOOL_DEFINITIONS,
    });
  }

  throw new Error("AI tool call limit exceeded");
}

export function normalizeMessages(messages, maxMessages = DEFAULT_MAX_MESSAGES) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new AiChatValidationError("Message is required");
  }

  const normalized = messages
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: `${message.content ?? ""}`.trim(),
    }))
    .filter((message) => message.content);

  if (!normalized.length) {
    throw new AiChatValidationError("Message is required");
  }

  const tooLong = normalized.some((message) => message.content.length > MAX_MESSAGE_CHARS);
  if (tooLong) {
    throw new AiChatValidationError("Message is too long");
  }

  return normalized;
}

export class AiChatValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AiChatValidationError";
    this.status = 400;
  }
}

export class AiChatConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "AiChatConfigError";
    this.status = 503;
  }
}

function getDefaultOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiChatConfigError("AI chat is not configured");
  }

  if (!defaultOpenAIClient) {
    defaultOpenAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return defaultOpenAIClient;
}

function buildInitialInput(messages, filters, pageContext, conversationHistory) {
  const parts = [];

  parts.push({
    role: "developer",
    content: `Dashboard context: ${JSON.stringify({
      filters: normalizeFilterSnapshot(filters),
      pageContext: sanitizePageContext(pageContext),
    })}`,
  });

  if (conversationHistory?.summary) {
    parts.push({
      role: "developer",
      content: `Previous conversation summary:\n${conversationHistory.summary}`,
    });
  }

  if (conversationHistory?.recentMessages?.length) {
    for (const msg of conversationHistory.recentMessages) {
      parts.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  for (const message of messages) {
    parts.push({
      role: message.role,
      content: message.content,
    });
  }

  return parts;
}

function sanitizePageContext(pageContext = {}) {
  return {
    route: typeof pageContext.route === "string" ? pageContext.route.slice(0, 120) : "",
    recordCount: Number.isFinite(Number(pageContext.recordCount)) ? Number(pageContext.recordCount) : null,
  };
}

function getFunctionCalls(response) {
  return (response.output || []).filter((item) => item.type === "function_call" && item.name && item.call_id);
}

function parseToolArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}

function extractText(response) {
  const textParts = [];
  for (const item of response.output || []) {
    if (item.type === "message") {
      for (const content of item.content || []) {
        if (content.type === "output_text" && content.text) {
          textParts.push(content.text);
        }
      }
    }
  }
  return textParts.join("\n").trim();
}
