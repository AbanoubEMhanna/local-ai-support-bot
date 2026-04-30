import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "./modules/app.module";

const dbMock = vi.hoisted(() => ({
  getAiMetrics: vi.fn().mockResolvedValue({
    totalRequests: 0,
    averageLatencyMs: 0,
    averageRetrievalCount: 0,
    latest: []
  }),
  createSupportDocument: vi.fn(),
  getSupportDocument: vi.fn(),
  updateDocumentIngestionState: vi.fn(),
  updateSupportDocumentStoragePath: vi.fn(),
  replaceDocumentChunks: vi.fn(),
  deleteSupportDocument: vi.fn(),
  listSupportDocuments: vi.fn().mockResolvedValue([]),
  listDocumentChunks: vi.fn().mockResolvedValue([]),
  searchDocumentChunks: vi.fn().mockResolvedValue([
    {
      documentId: "doc-1",
      documentTitle: "Support Doc",
      chunkId: "chunk-1",
      chunkIndex: 0,
      content: "Customers can use the onboarding checklist.",
      score: 0.95
    }
  ]),
  createConversation: vi.fn().mockResolvedValue("conversation-1"),
  addConversationMessage: vi.fn().mockResolvedValue(undefined),
  recordAiMetric: vi.fn().mockResolvedValue(undefined),
  listConversations: vi.fn().mockResolvedValue([]),
  getConversation: vi.fn().mockResolvedValue(null)
}));

vi.mock("@local-ai-support-bot/db", () => dbMock);

vi.mock("@local-ai-support-bot/ai", async () => {
  const actual = await vi.importActual<typeof import("@local-ai-support-bot/ai")>("@local-ai-support-bot/ai");

  return {
    ...actual,
    createAiClient: vi.fn(() => ({
      generateEmbedding: vi.fn().mockResolvedValue({
        provider: "ollama",
        model: "llama3.1:8b",
        embedding: [1, 0, 0],
        latencyMs: 1
      }),
      generateText: vi.fn().mockResolvedValue({
        provider: "ollama",
        model: "llama3.1:8b",
        content: "Use the onboarding checklist. [1]",
        latencyMs: 1
      })
    }))
  };
});

describe("API smoke tests", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return async () => {
      await app.close();
    };
  });

  it("returns health config", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      service: "local-ai-support-bot-api",
      ai: {
        provider: "ollama",
        chatModel: "llama3.1:8b"
      }
    });
  });

  it("lists documents", async () => {
    const response = await request(app.getHttpServer()).get("/documents").expect(200);

    expect(response.body).toEqual({ documents: [] });
  });

  it("returns AI metrics", async () => {
    const response = await request(app.getHttpServer()).get("/metrics/ai").expect(200);

    expect(response.body).toMatchObject({ totalRequests: 0, latest: [] });
  });

  it("returns ingestion status without requiring Redis in tests", async () => {
    dbMock.getSupportDocument.mockResolvedValueOnce({
      id: "doc-1",
      title: "Support Doc",
      filename: "support.md",
      contentType: "text/markdown",
      status: "UPLOADED",
      chunkCount: 0,
      errorMessage: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      storagePath: "/tmp/support.md",
      rawText: null
    });

    const response = await request(app.getHttpServer()).get("/documents/doc-1/ingestion").expect(200);

    expect(response.body).toMatchObject({
      documentId: "doc-1",
      queueEnabled: false,
      jobId: null,
      state: "disabled",
      progress: 0
    });
  });

  it("answers RAG chat requests without calling a real local model", async () => {
    const response = await request(app.getHttpServer())
      .post("/chat")
      .send({ message: "How do customers get setup help?" })
      .expect(201);

    expect(response.body).toMatchObject({
      conversationId: "conversation-1",
      answer: "Use the onboarding checklist. [1]",
      provider: "ollama",
      model: "llama3.1:8b",
      retrievalCount: 1
    });
    expect(response.body.citations).toHaveLength(1);
  });
});
