import { Module } from "@nestjs/common";
import { DocumentIngestionQueue } from "./document-ingestion.queue";
import { DocumentIngestionWorker } from "./document-ingestion.worker";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentIngestionQueue, DocumentIngestionWorker, DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule {}
