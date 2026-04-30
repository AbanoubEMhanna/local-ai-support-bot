import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";
import type { DocumentIngestionStatusResponse } from "@local-ai-support-bot/shared";

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

  async getDocumentIngestionStatus(documentId: string): Promise<DocumentIngestionStatusResponse> {
    if (!this.isEnabled()) {
      return emptyIngestionStatus(documentId, false, "disabled");
    }

    const jobs = await this.getQueue().getJobs(["active", "waiting", "delayed", "completed", "failed"], 0, 100);
    const job = jobs
      .filter((currentJob) => currentJob.data.documentId === documentId)
      .sort((first, second) => second.timestamp - first.timestamp)[0];

    if (!job) {
      return emptyIngestionStatus(documentId, true, "unknown");
    }

    const state = await job.getState();
    const progress = typeof job.progress === "number" ? job.progress : 0;

    return {
      documentId,
      queueEnabled: true,
      jobId: job.id ?? null,
      state: normalizeJobState(state),
      progress,
      attemptsMade: job.attemptsMade,
      attemptsTotal: Number(job.opts.attempts || 1),
      failedReason: job.failedReason || null,
      queuedAt: timestampToIso(job.timestamp),
      processedAt: timestampToIso(job.processedOn),
      finishedAt: timestampToIso(job.finishedOn)
    };
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

function emptyIngestionStatus(
  documentId: string,
  queueEnabled: boolean,
  state: DocumentIngestionStatusResponse["state"]
): DocumentIngestionStatusResponse {
  return {
    documentId,
    queueEnabled,
    jobId: null,
    state,
    progress: 0,
    attemptsMade: 0,
    attemptsTotal: Number(process.env.INGESTION_JOB_ATTEMPTS || 3),
    failedReason: null,
    queuedAt: null,
    processedAt: null,
    finishedAt: null
  };
}

function normalizeJobState(state: string): DocumentIngestionStatusResponse["state"] {
  if (["waiting", "active", "delayed", "completed", "failed"].includes(state)) {
    return state as DocumentIngestionStatusResponse["state"];
  }

  return "unknown";
}

function timestampToIso(timestamp?: number): string | null {
  return timestamp ? new Date(timestamp).toISOString() : null;
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
