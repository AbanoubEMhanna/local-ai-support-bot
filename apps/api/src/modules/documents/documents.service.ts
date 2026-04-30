import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { createAiClient, loadAiConfig } from "@local-ai-support-bot/ai";
import {
  createSupportDocument,
  deleteSupportDocument,
  getSupportDocument,
  listDocumentChunks,
  listSupportDocuments,
  replaceDocumentChunks,
  updateDocumentIngestionState
} from "@local-ai-support-bot/db";
import type { GetDocumentChunksResponse, ListDocumentsResponse, SupportDocument, UploadDocumentResponse } from "@local-ai-support-bot/shared";
import { chunkText, extractTextFromFile } from "./text-extraction";

@Injectable()
export class DocumentsService {
  private readonly storageDir = process.env.STORAGE_DIR ? resolve(process.env.STORAGE_DIR) : resolve(process.cwd(), "../..", "storage");

  async upload(file: Express.Multer.File, title?: string): Promise<UploadDocumentResponse> {
    if (!file) {
      throw new Error("file is required");
    }

    const extractedText = await extractTextFromFile({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype || "application/octet-stream"
    });

    const document = await createSupportDocument({
      title: title?.trim() || file.originalname,
      filename: file.originalname,
      contentType: file.mimetype || "application/octet-stream",
      storagePath: "",
      sizeBytes: file.size,
      rawText: extractedText
    });
    const storagePath = await this.writeDocumentFile(document.id, file.originalname, file.buffer);

    await updateDocumentIngestionState({
      documentId: document.id,
      status: "UPLOADED",
      rawText: extractedText,
      errorMessage: null
    });

    await this.setStoragePath(document.id, storagePath);
    const ingested = await this.ingest(document.id);
    return { document: this.toPublicDocument(ingested) };
  }

  async list(): Promise<ListDocumentsResponse> {
    return { documents: await listSupportDocuments() };
  }

  async get(id: string): Promise<SupportDocument> {
    const document = await getSupportDocument(id);
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    return this.toPublicDocument(document);
  }

  async getChunks(id: string): Promise<GetDocumentChunksResponse> {
    await this.get(id);
    return { chunks: await listDocumentChunks(id) };
  }

  async remove(id: string): Promise<void> {
    const document = await getSupportDocument(id);
    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await deleteSupportDocument(id);
    if (document.storagePath) {
      await unlink(document.storagePath).catch(() => undefined);
    }
  }

  async ingest(id: string): Promise<SupportDocument> {
    const document = await getSupportDocument(id);
    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await updateDocumentIngestionState({ documentId: id, status: "INGESTING", errorMessage: null });

    try {
      const text = document.rawText || await this.extractFromStoredDocument(document);
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        throw new Error("Document did not contain readable text");
      }

      const aiConfig = loadAiConfig();
      const aiClient = createAiClient(aiConfig);
      const embeddedChunks = [];

      for (const chunk of chunks) {
        const embedding = await aiClient.generateEmbedding(chunk.content);
        embeddedChunks.push({
          ...chunk,
          embedding: embedding.embedding
        });
      }

      await replaceDocumentChunks({ documentId: id, chunks: embeddedChunks });
      await updateDocumentIngestionState({ documentId: id, status: "READY", rawText: text, errorMessage: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingestion error";
      await updateDocumentIngestionState({ documentId: id, status: "FAILED", errorMessage: message });
    }

    return this.get(id);
  }

  private async extractFromStoredDocument(document: { storagePath: string; filename: string; contentType: string }): Promise<string> {
    const buffer = await readFile(document.storagePath);
    return extractTextFromFile({
      buffer,
      filename: document.filename,
      contentType: document.contentType
    });
  }

  private async writeDocumentFile(documentId: string, filename: string, buffer: Buffer): Promise<string> {
    const documentsDir = join(this.storageDir, "documents");
    await mkdir(documentsDir, { recursive: true });
    const storagePath = join(documentsDir, `${documentId}${extname(filename) || ".txt"}`);
    await writeFile(storagePath, buffer);
    return storagePath;
  }

  private async setStoragePath(documentId: string, storagePath: string): Promise<void> {
    const { getPrismaClient } = await import("@local-ai-support-bot/db");
    await getPrismaClient().document.update({
      where: { id: documentId },
      data: { storagePath }
    });
  }

  private toPublicDocument(document: SupportDocument): SupportDocument {
    return {
      id: document.id,
      title: document.title,
      filename: document.filename,
      contentType: document.contentType,
      status: document.status,
      chunkCount: document.chunkCount,
      errorMessage: document.errorMessage,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }
}
