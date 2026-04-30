import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";

export const DOCUMENT_INGESTION_QUEUE = "document-ingestion";
export const DOCUMENT_INGESTION_JOB = "ingest-document";

export interface DocumentIngestionJobData {
  documentId: string;
  reason: "upload" | "manual";
  requestedAt: string;
}

export interface EnqueueDocumentIngestionResult {
  queued: boolean;
  jobId: string | null;
}

@Injectable()
export class DocumentIngestionQueue implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentIngestionQueue.name);
  private queue: Queue<DocumentIngestionJobData> | null = null;

  isEnabled(): boolean {
    return isDocumentIngestionQueueEnabled();
  }

  async enqueueDocumentIngestion(documentId: string, reason: DocumentIngestionJobData["reason"]): Promise<EnqueueDocumentIngestionResult> {
    if (!this.isEnabled()) {
      this.logger.warn(`Document ingestion queue is disabled; document ${documentId} was not queued.`);
      return { queued: false, jobId: null };
    }

    const job = await this.getQueue().add(
      DOCUMENT_INGESTION_JOB,
      {
        documentId,
        reason,
        requestedAt: new Date().toISOString()
      },
      documentIngestionJobOptions()
    );

    return { queued: true, jobId: job.id ?? null };
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.queue) {
      return;
    }

    await this.queue.close();
    this.queue = null;
  }

  private getQueue(): Queue<DocumentIngestionJobData> {
    this.queue ??= new Queue<DocumentIngestionJobData>(DOCUMENT_INGESTION_QUEUE, {
      connection: createRedisConnectionOptions()
    });

    return this.queue;
  }
}

export function isDocumentIngestionQueueEnabled(): boolean {
  if (process.env.INGESTION_QUEUE_ENABLED === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

export function createRedisConnectionOptions() {
  const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: redisUrl.pathname ? Number(redisUrl.pathname.slice(1) || 0) : 0,
    maxRetriesPerRequest: null
  };
}

function documentIngestionJobOptions(): JobsOptions {
  return {
    attempts: Number(process.env.INGESTION_JOB_ATTEMPTS || 3),
    backoff: {
      type: "exponential",
      delay: Number(process.env.INGESTION_JOB_BACKOFF_MS || 5000)
    },
    removeOnComplete: {
      count: Number(process.env.INGESTION_KEEP_COMPLETED_JOBS || 50)
    },
    removeOnFail: {
      count: Number(process.env.INGESTION_KEEP_FAILED_JOBS || 100)
    }
  };
}
