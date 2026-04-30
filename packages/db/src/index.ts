import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { AiProvider, Citation, DocumentChunk, DocumentStatus, SupportDocument } from "@local-ai-support-bot/shared";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/local_ai_support_bot";

export const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || "demo-workspace";

let prismaClient: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  prismaClient ??= new PrismaClient();
  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaClient) {
    return;
  }

  await prismaClient.$disconnect();
  prismaClient = undefined;
}

export async function applyDatabaseSchema(): Promise<void> {
  const prisma = getPrismaClient();
  const statements = [
    `CREATE EXTENSION IF NOT EXISTS vector`,
    `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
    `CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      raw_text TEXT,
      status TEXT NOT NULL DEFAULT 'UPLOADED',
      error_message TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      token_count INTEGER NOT NULL,
      embedding vector NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ai_metrics (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      retrieval_count INTEGER NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON documents(workspace_id)`,
    `CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status)`,
    `CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id)`,
    `CREATE INDEX IF NOT EXISTS document_chunks_workspace_id_idx ON document_chunks(workspace_id)`,
    `CREATE INDEX IF NOT EXISTS conversations_workspace_id_idx ON conversations(workspace_id)`,
    `CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id)`,
    `CREATE INDEX IF NOT EXISTS ai_metrics_workspace_id_idx ON ai_metrics(workspace_id)`,
    `CREATE INDEX IF NOT EXISTS ai_metrics_created_at_idx ON ai_metrics(created_at)`
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function ensureDefaultWorkspace(name = "Demo Workspace"): Promise<void> {
  await applyDatabaseSchema();
  const prisma = getPrismaClient();
  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name
    },
    update: {}
  });
}

export async function createSupportDocument(input: {
  title: string;
  filename: string;
  contentType: string;
  storagePath: string;
  sizeBytes: number;
  rawText?: string;
}): Promise<SupportDocument> {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  const document = await prisma.document.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: input.title,
      filename: input.filename,
      contentType: input.contentType,
      storagePath: input.storagePath,
      sizeBytes: input.sizeBytes,
      rawText: input.rawText,
      status: "UPLOADED"
    }
  });

  return toSupportDocument(document, 0);
}

export async function listSupportDocuments(): Promise<SupportDocument[]> {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  const documents = await prisma.document.findMany({
    where: { workspaceId: DEFAULT_WORKSPACE_ID },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" }
  });

  return documents.map((document) => toSupportDocument(document, document._count.chunks));
}

export async function getSupportDocument(id: string): Promise<(SupportDocument & { storagePath: string; rawText: string | null }) | null> {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  const document = await prisma.document.findFirst({
    where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
    include: { _count: { select: { chunks: true } } }
  });

  if (!document) {
    return null;
  }

  return {
    ...toSupportDocument(document, document._count.chunks),
    storagePath: document.storagePath,
    rawText: document.rawText
  };
}

export async function deleteSupportDocument(id: string): Promise<void> {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  await prisma.document.deleteMany({
    where: { id, workspaceId: DEFAULT_WORKSPACE_ID }
  });
}

export async function updateDocumentIngestionState(input: {
  documentId: string;
  status: DocumentStatus;
  rawText?: string;
  errorMessage?: string | null;
}): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.document.update({
    where: { id: input.documentId },
    data: {
      status: input.status,
      rawText: input.rawText,
      errorMessage: input.errorMessage ?? null
    }
  });
}

export async function replaceDocumentChunks(input: {
  documentId: string;
  chunks: Array<{
    content: string;
    chunkIndex: number;
    tokenCount: number;
    embedding: number[];
  }>;
}): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.documentChunk.deleteMany({ where: { documentId: input.documentId } });

    for (const chunk of input.chunks) {
      await tx.$executeRawUnsafe(
        `INSERT INTO document_chunks (id, document_id, workspace_id, content, chunk_index, token_count, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW())`,
        randomUUID(),
        input.documentId,
        DEFAULT_WORKSPACE_ID,
        chunk.content,
        chunk.chunkIndex,
        chunk.tokenCount,
        vectorToSql(chunk.embedding)
      );
    }
  });
}

export async function listDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.documentChunk.findMany({
    where: {
      documentId,
      workspaceId: DEFAULT_WORKSPACE_ID
    },
    orderBy: { chunkIndex: "asc" }
  });

  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    content: row.content,
    chunkIndex: row.chunkIndex,
    tokenCount: row.tokenCount
  }));
}

export async function searchDocumentChunks(embedding: number[], limit = 5): Promise<Citation[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      document_id: string;
      document_title: string;
      content: string;
      chunk_index: number;
      score: number;
    }>
  >(
    `SELECT
       dc.id,
       dc.document_id,
       d.title AS document_title,
       dc.content,
       dc.chunk_index,
       1 - (dc.embedding <=> $1::vector) AS score
     FROM document_chunks dc
     INNER JOIN documents d ON d.id = dc.document_id
     WHERE dc.workspace_id = $2 AND d.status = 'READY'
     ORDER BY dc.embedding <=> $1::vector
     LIMIT $3`,
    vectorToSql(embedding),
    DEFAULT_WORKSPACE_ID,
    limit
  );

  return rows.map((row) => ({
    documentId: row.document_id,
    documentTitle: row.document_title,
    chunkId: row.id,
    chunkIndex: row.chunk_index,
    content: row.content,
    score: Number(row.score)
  }));
}

export async function createConversation(input: { title: string }): Promise<string> {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  const conversation = await prisma.conversation.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: input.title
    }
  });
  return conversation.id;
}

export async function addConversationMessage(input: {
  conversationId: string;
  role: "system" | "user" | "assistant";
  content: string;
  citations?: Citation[];
}): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      citations: input.citations ? JSON.stringify(input.citations) : null
    }
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() }
  });
}

export async function listConversations() {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: DEFAULT_WORKSPACE_ID },
    include: { _count: { select: { messages: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation._count.messages
  }));
}

export async function getConversation(id: string) {
  const prisma = getPrismaClient();
  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });

  if (!conversation) {
    return null;
  }

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation.messages.length
    },
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role as "system" | "user" | "assistant",
      content: message.content,
      citations: parseCitations(message.citations),
      createdAt: message.createdAt.toISOString()
    }))
  };
}

export async function recordAiMetric(input: {
  provider: AiProvider;
  model: string;
  latencyMs: number;
  retrievalCount: number;
}): Promise<void> {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  await prisma.aiMetric.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      provider: input.provider,
      model: input.model,
      latencyMs: input.latencyMs,
      retrievalCount: input.retrievalCount
    }
  });
}

export async function getAiMetrics() {
  await ensureDefaultWorkspace();
  const prisma = getPrismaClient();
  const [aggregate, latest] = await Promise.all([
    prisma.aiMetric.aggregate({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      _count: { _all: true },
      _avg: {
        latencyMs: true,
        retrievalCount: true
      }
    }),
    prisma.aiMetric.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

  return {
    totalRequests: aggregate._count._all,
    averageLatencyMs: Math.round(aggregate._avg.latencyMs ?? 0),
    averageRetrievalCount: Number((aggregate._avg.retrievalCount ?? 0).toFixed(2)),
    latest: latest.map((metric) => ({
      id: metric.id,
      provider: metric.provider as AiProvider,
      model: metric.model,
      latencyMs: metric.latencyMs,
      retrievalCount: metric.retrievalCount,
      createdAt: metric.createdAt.toISOString()
    }))
  };
}

function toSupportDocument(document: {
  id: string;
  title: string;
  filename: string;
  contentType: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}, chunkCount: number): SupportDocument {
  return {
    id: document.id,
    title: document.title,
    filename: document.filename,
    contentType: document.contentType,
    status: document.status as DocumentStatus,
    chunkCount,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

function vectorToSql(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function parseCitations(value: string | null): Citation[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
