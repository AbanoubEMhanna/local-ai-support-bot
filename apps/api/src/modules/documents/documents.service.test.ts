import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentIngestionStatusResponse, SupportDocument } from "@local-ai-support-bot/shared";
import { DocumentsService } from "./documents.service";
import type { DocumentIngestionQueue } from "./document-ingestion.queue";

const dbMock = vi.hoisted(() => ({
  createSupportDocument: vi.fn(),
  deleteSupportDocument: vi.fn(),
  getSupportDocument: vi.fn(),
  listDocumentChunks: vi.fn(),
  listSupportDocuments: vi.fn(),
  replaceDocumentChunks: vi.fn(),
  updateDocumentIngestionState: vi.fn(),
  updateSupportDocumentStoragePath: vi.fn()
}));

const aiMock = vi.hoisted(() => ({
  createAiClient: vi.fn(),
  loadAiConfig: vi.fn()
}));

vi.mock("@local-ai-support-bot/db", () => dbMock);
vi.mock("@local-ai-support-bot/ai", () => aiMock);

function supportDocument(overrides: Partial<SupportDocument> = {}): SupportDocument {
  return {
    id: "doc-1",
    title: "Support FAQ",
    filename: "faq.md",
    contentType: "text/markdown",
    status: "UPLOADED",
    chunkCount: 0,
    errorMessage: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("DocumentsService queued ingestion", () => {
  let storageDir: string;
  let queue: Pick<DocumentIngestionQueue, "enqueueDocumentIngestion" | "getDocumentIngestionStatus">;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageDir = await mkdtemp(join(tmpdir(), "local-ai-support-bot-"));
    process.env.STORAGE_DIR = storageDir;
    queue = {
      enqueueDocumentIngestion: vi.fn().mockResolvedValue({ queued: true, jobId: "job-1" }),
      getDocumentIngestionStatus: vi.fn().mockResolvedValue({
        documentId: "doc-1",
        queueEnabled: true,
        jobId: "job-1",
        state: "active",
        progress: 45,
        attemptsMade: 1,
        attemptsTotal: 3,
        failedReason: null,
        queuedAt: "2026-01-01T00:00:00.000Z",
        processedAt: "2026-01-01T00:00:01.000Z",
        finishedAt: null
      } satisfies DocumentIngestionStatusResponse)
    };
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it("uploads a supported file and queues ingestion without generating embeddings inline", async () => {
    let storedDocument = {
      ...supportDocument(),
      storagePath: "",
      rawText: null
    };

    dbMock.createSupportDocument.mockResolvedValue(supportDocument());
    dbMock.updateSupportDocumentStoragePath.mockImplementation(async ({ storagePath }) => {
      storedDocument = { ...storedDocument, storagePath };
    });
    dbMock.getSupportDocument.mockImplementation(async () => storedDocument);

    const service = new DocumentsService(queue as DocumentIngestionQueue);
    const response = await service.upload({
      buffer: Buffer.from("# Support FAQ\n\nCustomers can use onboarding."),
      originalname: "faq.md",
      mimetype: "text/markdown",
      size: 41
    } as Express.Multer.File);

    expect(response.document).toMatchObject({ id: "doc-1", status: "UPLOADED", chunkCount: 0 });
    expect(queue.enqueueDocumentIngestion).toHaveBeenCalledWith("doc-1", "upload");
    expect(aiMock.createAiClient).not.toHaveBeenCalled();
    expect(dbMock.replaceDocumentChunks).not.toHaveBeenCalled();
    expect(await readFile(storedDocument.storagePath, "utf8")).toContain("Support FAQ");
  });

  it("processes queued ingestion and stores chunks with local embeddings", async () => {
    const storedPath = join(storageDir, "faq.md");
    await writeFile(storedPath, "# Support FAQ\n\nCustomers can use onboarding docs.");

    dbMock.getSupportDocument.mockResolvedValue({
      ...supportDocument(),
      storagePath: storedPath,
      rawText: null
    });
    dbMock.updateDocumentIngestionState.mockResolvedValue(undefined);
    dbMock.replaceDocumentChunks.mockResolvedValue(undefined);
    aiMock.loadAiConfig.mockReturnValue({ provider: "ollama", embeddingModel: "nomic-embed-text" });
    aiMock.createAiClient.mockReturnValue({
      generateEmbedding: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })
    });

    const progress: number[] = [];
    const service = new DocumentsService(queue as DocumentIngestionQueue);
    await service.processIngestion("doc-1", async (value) => {
      progress.push(value);
    });

    expect(dbMock.updateDocumentIngestionState).toHaveBeenCalledWith({ documentId: "doc-1", status: "INGESTING", errorMessage: null });
    expect(dbMock.replaceDocumentChunks).toHaveBeenCalledWith({
      documentId: "doc-1",
      chunks: expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("Customers can use onboarding docs."),
          chunkIndex: 0,
          embedding: [0.1, 0.2, 0.3]
        })
      ])
    });
    expect(dbMock.updateDocumentIngestionState).toHaveBeenLastCalledWith({
      documentId: "doc-1",
      status: "READY",
      rawText: "# Support FAQ\n\nCustomers can use onboarding docs.",
      errorMessage: null
    });
    expect(progress).toContain(100);
  });

  it("returns current ingestion job status for an existing document", async () => {
    dbMock.getSupportDocument.mockResolvedValue({
      ...supportDocument({ status: "INGESTING" }),
      storagePath: "/tmp/doc.md",
      rawText: null
    });

    const service = new DocumentsService(queue as DocumentIngestionQueue);
    const response = await service.getIngestionStatus("doc-1");

    expect(response).toMatchObject({
      documentId: "doc-1",
      queueEnabled: true,
      jobId: "job-1",
      state: "active",
      progress: 45,
      attemptsMade: 1,
      attemptsTotal: 3
    });
    expect(queue.getDocumentIngestionStatus).toHaveBeenCalledWith("doc-1");
  });
});
