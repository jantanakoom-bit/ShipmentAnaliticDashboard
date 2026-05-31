import { apiRequest } from "./api";

export async function sendAiChatMessage({ messages, filters, pageContext }) {
  return apiRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages, filters, pageContext }),
  });
}
