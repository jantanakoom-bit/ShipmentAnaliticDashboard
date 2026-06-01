import { apiRequest } from "./api";

export async function sendAiChatMessage({ messages, filters, pageContext, conversationId }) {
  return apiRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages, filters, pageContext, conversationId }),
  });
}
