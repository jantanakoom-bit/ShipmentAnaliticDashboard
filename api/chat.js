import { aiChatHandler } from "./_lib/aiChatHandler.js";

export default async function handler(req, res) {
  await aiChatHandler(req, res);
}
