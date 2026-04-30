import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import {
  createRedisConnectionOptions,
  DOCUMENT_INGESTION_JOB,
  DOCUMENT_INGESTION_QUEUE,
  type DocumentIngestionJobData,
  isDocumentIngestionQueueEnabled
} from "./document-ingestion.queue";
import { DocumentsService } from "./documents.service";

@Injectable()
export class DocumentIngestionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentIngestionWorker.name);
  private worker: Worker<DocumentIngestionJobData> | null = null;

  constructor(private readonly documentsService: DocumentsService) {}

  onModuleInit(): void {
    if (!isDocumentIngestionQueueEnabled()) {
      return;
    }

    this.worker = new Worker<DocumentIngestionJobData>(
      DOCUMENT_INGESTION_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: createRedisConnectionOptions(),
        concurrency: Number(process.env.INGESTION_WORKER_CONCURRENCY || 1)
      }
    );

    this.worker.on("completed", (job) => {
      this.logger.log(`Completed ${DOCUMENT_INGESTION_JOB} job ${job.id} for document ${job.data.documentId}.`);
    });

    this.worker.on("failed", (job, error) => {
      this.logger.error(`Failed ${DOCUMENT_INGESTION_JOB} job ${job?.id ?? "unknown"}: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = null;
  }

  private async processJob(job: Job<DocumentIngestionJobData>): Promise<void> {
    if (job.name !== DOCUMENT_INGESTION_JOB) {
      throw new Error(`Unsupported document ingestion job: ${job.name}`);
    }

    await this.documentsService.processIngestion(job.data.documentId, (progress) => job.updateProgress(progress));
  }
}
