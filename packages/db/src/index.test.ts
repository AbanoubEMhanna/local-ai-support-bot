import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Citation } from "@local-ai-support-bot/shared";

let db: typeof import("./index");

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/local_ai_support_bot";
  process.env.DEFAULT_WORKSPACE_ID = `test-${randomUUID()}`;
  db = await import("./index");
  await db.applyDatabaseSchema();
});

describe("database integration", () => {
  it("creates and lists support documents", async () => {
    const document = await db.createSupportDocument({
      title: "Test Support Doc",
      filename: "support.md",
      contentType: "text/markdown",
      storagePath: "/tmp/support.md",
      sizeBytes: 120,
      rawText: "Customers can get setup help."
    });

    const documents = await db.listSupportDocuments();

    expect(document.title).toBe("Test Support Doc");
    expect(documents.some((current) => current.id === document.id)).toBe(true);
  });

  it("stores chunks and retrieves citations with pgvector similarity search", async () => {
    const document = await db.createSupportDocument({
      title: "Vector Doc",
      filename: "vector.md",
      contentType: "text/markdown",
      storagePath: "/tmp/vector.md",
      sizeBytes: 120,
      rawText: "The setup guide uses local AI."
    });

    await db.replaceDocumentChunks({
      documentId: document.id,
      chunks: [
        {
          content: "Customers can get setup help from the onboarding checklist.",
          chunkIndex: 0,
          tokenCount: 10,
          embedding: [1, 0, 0]
        },
        {
          content: "Billing is not part of this demo.",
          chunkIndex: 1,
          tokenCount: 8,
          embedding: [0, 1, 0]
        }
      ]
    });
    await db.updateDocumentIngestionState({ documentId: document.id, status: "READY" });

    const citations = await db.searchDocumentChunks([1, 0, 0], 1);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      documentId: document.id,
      documentTitle: "Vector Doc",
      chunkIndex: 0
    } satisfies Partial<Citation>);
  });

  it("persists conversations and AI metrics", async () => {
    const conversationId = await db.createConversation({ title: "Setup help" });
    await db.addConversationMessage({ conversationId, role: "user", content: "How do I start?" });
    await db.addConversationMessage({
      conversationId,
      role: "assistant",
      content: "Use the checklist.",
      citations: []
    });
    await db.recordAiMetric({
      provider: "ollama",
      model: "llama3.1:8b",
      latencyMs: 100,
      retrievalCount: 1
    });

    const conversation = await db.getConversation(conversationId);
    const conversations = await db.listConversations();
    const metrics = await db.getAiMetrics();

    expect(conversation?.messages).toHaveLength(2);
    expect(conversations.some((current) => current.id === conversationId)).toBe(true);
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
    expect(metrics.latest[0]).toMatchObject({ provider: "ollama", model: "llama3.1:8b" });
  });
});

