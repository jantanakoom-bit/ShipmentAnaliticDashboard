import { randomUUID } from "node:crypto";

const CONVERSATION_TTL_MS = 60 * 60 * 1000; // 1 hour idle
const SUMMARIZE_THRESHOLD = 20;              // messages before summarization triggers
const RECENT_WINDOW = 8;                     // most recent messages kept in full
const MAX_SUMMARY_LENGTH = 3000;             // chars, to control token usage

const conversations = new Map();

function makeKey(userId, conversationId) {
  return `${userId}::${conversationId}`;
}

export function createConversation(userId, conversationId) {
  const id = conversationId || `conv_${randomUUID()}`;
  const conversation = {
    id,
    userId,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    messages: [],
    summary: null,
    summaryThrough: 0,
    previousResponseId: null,
  };
  conversations.set(makeKey(userId, id), conversation);
  return conversation;
}

export function getConversation(userId, conversationId) {
  pruneStaleConversations();
  const conversation = conversations.get(makeKey(userId, conversationId));
  if (!conversation) {
    return null;
  }
  conversation.lastActiveAt = Date.now();
  return conversation;
}

export function addMessages(userId, conversationId, newMessages) {
  const conversation = conversations.get(makeKey(userId, conversationId));
  if (!conversation) {
    return null;
  }

  for (const msg of newMessages) {
    conversation.messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: `${msg.content ?? ""}`.trim(),
      timestamp: msg.timestamp || Date.now(),
    });
  }
  conversation.lastActiveAt = Date.now();

  if (conversation.messages.length > SUMMARIZE_THRESHOLD && !conversation.summary) {
    summarizeHistory(conversation);
  }

  return conversation;
}

export function summarizeHistory(conversation) {
  if (conversation.messages.length <= SUMMARIZE_THRESHOLD) {
    return conversation;
  }

  const splitIndex = Math.max(0, conversation.messages.length - RECENT_WINDOW);
  const olderMessages = conversation.messages.slice(0, splitIndex);

  if (!olderMessages.length) {
    return conversation;
  }

  const topics = extractTopics(olderMessages);
  const summary = buildSummary(topics, olderMessages);
  conversation.summary = summary.slice(0, MAX_SUMMARY_LENGTH);
  conversation.summaryThrough = splitIndex;

  return conversation;
}

function extractTopics(messages) {
  const userMessages = messages.filter((m) => m.role === "user");
  const allText = userMessages.map((m) => m.content).join(" ");

  const topics = [];

  const questionCount = (allText.match(/\?/g) || []).length;
  if (questionCount > 0) {
    topics.push(`${questionCount} question${questionCount > 1 ? "s" : ""} asked`);
  }

  const metricKeywords = ["teu", "carrier", "shipper", "route", "trade", "status", "port", "country", "destination", "booking", "shipment", "container", "qty", "filter", "analytics", "summary"];
  const found = metricKeywords.filter((kw) => allText.toLowerCase().includes(kw));
  if (found.length) {
    topics.push(`topics: ${found.join(", ")}`);
  }

  if (!topics.length) {
    topics.push("general shipment inquiry");
  }

  return topics;
}

function buildSummary(topics, olderMessages) {
  const assistantCount = olderMessages.filter((m) => m.role === "assistant").length;
  const parts = [
    `Earlier in this conversation (${olderMessages.length} messages, ${assistantCount} assistant responses):`,
    `The user ${topics.join("; ")}.`,
    "The assistant provided shipment data including metrics, tables, and analysis based on the dashboard tools.",
  ];

  return parts.join(" ");
}

export function buildMemoryContext(conversation) {
  if (!conversation) {
    return { summary: null, recentMessages: [], previousResponseId: null };
  }

  let recentMessages;
  if (conversation.summary && conversation.summaryThrough > 0) {
    recentMessages = conversation.messages.slice(conversation.summaryThrough);
  } else {
    recentMessages = conversation.messages.slice(-RECENT_WINDOW);
  }

  return {
    summary: conversation.summary,
    recentMessages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
    previousResponseId: conversation.previousResponseId || null,
  };
}

export function deleteConversation(userId, conversationId) {
  return conversations.delete(makeKey(userId, conversationId));
}

export function pruneStaleConversations() {
  const now = Date.now();
  const staleKeys = [];

  for (const [key, conversation] of conversations) {
    if (now - conversation.lastActiveAt > CONVERSATION_TTL_MS) {
      staleKeys.push(key);
    }
  }

  for (const key of staleKeys) {
    conversations.delete(key);
  }
}
