import { beforeEach, describe, expect, test } from "vitest";
import {
  addMessages,
  buildMemoryContext,
  createConversation,
  deleteConversation,
  getConversation,
  pruneStaleConversations,
  summarizeHistory,
} from "./chatMemory.js";

describe("chatMemory", () => {
  const userId = "testuser";
  const otherUser = "otheruser";

  beforeEach(() => {
    // Clean up all conversations between tests by pruning with zero TTL trick:
    // we can't access the internal Map directly, so delete known conversations.
    // Instead, rely on userId isolation and unique conversation IDs per test.
  });

  describe("createConversation", () => {
    test("initializes with correct shape", () => {
      const conv = createConversation(userId);
      expect(conv).toBeDefined();
      expect(conv.id).toMatch(/^conv_/);
      expect(conv.userId).toBe(userId);
      expect(conv.messages).toEqual([]);
      expect(conv.summary).toBeNull();
      expect(conv.summaryThrough).toBe(0);
      expect(conv.previousResponseId).toBeNull();
      expect(typeof conv.createdAt).toBe("number");
      expect(typeof conv.lastActiveAt).toBe("number");
    });

    test("accepts explicit conversationId", () => {
      const conv = createConversation(userId, "my-custom-id");
      expect(conv.id).toBe("my-custom-id");
    });
  });

  describe("getConversation", () => {
    test("retrieves by userId+conversationId", () => {
      const conv = createConversation(userId);
      const retrieved = getConversation(userId, conv.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(conv.id);
    });

    test("returns null for unknown key", () => {
      const result = getConversation(userId, "nonexistent");
      expect(result).toBeNull();
    });

    test("returns null for wrong userId", () => {
      const conv = createConversation(userId);
      const result = getConversation(otherUser, conv.id);
      expect(result).toBeNull();
    });

    test("updates lastActiveAt on access", async () => {
      const conv = createConversation(userId);
      const originalActive = conv.lastActiveAt;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 5));

      getConversation(userId, conv.id);
      expect(conv.lastActiveAt).toBeGreaterThan(originalActive);
    });
  });

  describe("addMessages", () => {
    test("appends messages and updates lastActiveAt", () => {
      const conv = createConversation(userId);
      const originalActive = conv.lastActiveAt;

      addMessages(userId, conv.id, [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);

      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[0]).toMatchObject({ role: "user", content: "Hello" });
      expect(conv.messages[1]).toMatchObject({ role: "assistant", content: "Hi there" });
      expect(conv.messages[0].timestamp).toBeDefined();
      expect(conv.lastActiveAt).toBeGreaterThanOrEqual(originalActive);
    });

    test("returns null for unknown conversation", () => {
      const result = addMessages(userId, "nonexistent", [{ role: "user", content: "Hi" }]);
      expect(result).toBeNull();
    });

    test("normalizes message role", () => {
      const conv = createConversation(userId);
      addMessages(userId, conv.id, [{ role: "system", content: "Should become user" }]);
      expect(conv.messages[0].role).toBe("user");
    });
  });

  describe("summarizeHistory", () => {
    test("no-op when under threshold", () => {
      const conv = createConversation(userId);
      for (let i = 0; i < 15; i++) {
        conv.messages.push({ role: "user", content: `Message ${i}`, timestamp: Date.now() });
      }
      summarizeHistory(conv);
      expect(conv.summary).toBeNull();
      expect(conv.summaryThrough).toBe(0);
    });

    test("generates summary when above threshold", () => {
      const conv = createConversation(userId);
      for (let i = 0; i < 25; i++) {
        conv.messages.push({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i} about TEU and carriers`,
          timestamp: Date.now(),
        });
      }
      summarizeHistory(conv);
      expect(conv.summary).toBeDefined();
      expect(conv.summary.length).toBeGreaterThan(0);
      expect(conv.summary.length).toBeLessThanOrEqual(3000);
      expect(conv.summaryThrough).toBeGreaterThan(0);
    });

    test("leaves recent messages intact after summary", () => {
      const conv = createConversation(userId);
      for (let i = 0; i < 25; i++) {
        conv.messages.push({
          role: "user",
          content: `Message ${i}`,
          timestamp: Date.now(),
        });
      }
      const totalBefore = conv.messages.length;
      summarizeHistory(conv);

      // Recent messages beyond summaryThrough should still be there
      const recentCount = totalBefore - conv.summaryThrough;
      expect(recentCount).toBeGreaterThan(0);
    });

    test("summary mentions domain topics", () => {
      const conv = createConversation(userId);
      for (let i = 0; i < 25; i++) {
        conv.messages.push({
          role: "user",
          content: i % 3 === 0 ? "What is the top carrier by TEU?" : "Show me routes and shippers",
          timestamp: Date.now(),
        });
      }
      summarizeHistory(conv);
      expect(conv.summary).toMatch(/carrier|TEU|route|shipper/i);
    });
  });

  describe("buildMemoryContext", () => {
    test("returns correct shape for null conversation", () => {
      const ctx = buildMemoryContext(null);
      expect(ctx).toEqual({
        summary: null,
        recentMessages: [],
        previousResponseId: null,
      });
    });

    test("returns summary and recent messages", () => {
      const conv = createConversation(userId);
      conv.previousResponseId = "resp_123";
      for (let i = 0; i < 25; i++) {
        conv.messages.push({
          role: "user",
          content: `Message ${i}`,
          timestamp: Date.now(),
        });
      }
      summarizeHistory(conv);

      const ctx = buildMemoryContext(conv);
      expect(ctx.summary).toBeDefined();
      expect(ctx.previousResponseId).toBe("resp_123");
      expect(ctx.recentMessages.length).toBeGreaterThan(0);
    });

    test("limits recent messages when no summary", () => {
      const conv = createConversation(userId);
      for (let i = 0; i < 15; i++) {
        conv.messages.push({
          role: "user",
          content: `Message ${i}`,
          timestamp: Date.now(),
        });
      }

      const ctx = buildMemoryContext(conv);
      expect(ctx.recentMessages.length).toBeLessThanOrEqual(8);
      expect(ctx.summary).toBeNull();
    });
  });

  describe("deleteConversation", () => {
    test("removes conversation from store", () => {
      const conv = createConversation(userId);
      const deleted = deleteConversation(userId, conv.id);
      expect(deleted).toBe(true);

      const retrieved = getConversation(userId, conv.id);
      expect(retrieved).toBeNull();
    });

    test("returns false for nonexistent conversation", () => {
      const result = deleteConversation(userId, "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("pruneStaleConversations", () => {
    test("removes expired conversations", () => {
      const conv = createConversation(userId);
      // Artificially age the conversation
      conv.lastActiveAt = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      pruneStaleConversations();
      const retrieved = getConversation(userId, conv.id);
      expect(retrieved).toBeNull();
    });

    test("keeps active conversations", () => {
      const conv = createConversation(userId);
      pruneStaleConversations();
      const retrieved = getConversation(userId, conv.id);
      expect(retrieved).toBeDefined();
    });
  });

  describe("user isolation", () => {
    test("user A cannot access user B's conversation", () => {
      const convA = createConversation("userA");
      addMessages("userA", convA.id, [{ role: "user", content: "Secret data" }]);

      // User B cannot retrieve
      const result = getConversation("userB", convA.id);
      expect(result).toBeNull();

      // User B cannot add messages
      const addResult = addMessages("userB", convA.id, [{ role: "user", content: "Hacked" }]);
      expect(addResult).toBeNull();

      // User B cannot delete
      const delResult = deleteConversation("userB", convA.id);
      expect(delResult).toBe(false);
    });
  });

  describe("multiple conversations per user", () => {
    test("same user with multiple conversation IDs", () => {
      const conv1 = createConversation(userId);
      const conv2 = createConversation(userId);

      addMessages(userId, conv1.id, [{ role: "user", content: "Chat A" }]);
      addMessages(userId, conv2.id, [{ role: "user", content: "Chat B" }]);

      const retrieved1 = getConversation(userId, conv1.id);
      const retrieved2 = getConversation(userId, conv2.id);

      expect(retrieved1.messages[0].content).toBe("Chat A");
      expect(retrieved2.messages[0].content).toBe("Chat B");
    });
  });
});
