import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { GetDocumentChunksResponse, ListDocumentsResponse, SupportDocument, UploadDocumentResponse } from "@local-ai-support-bot/shared";
import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @Body("title") title?: string): Promise<UploadDocumentResponse> {
    return this.documentsService.upload(file, title);
  }

  @Get()
  list(): Promise<ListDocumentsResponse> {
    return this.documentsService.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<SupportDocument> {
    return this.documentsService.get(id);
  }

  @Get(":id/chunks")
  chunks(@Param("id") id: string): Promise<GetDocumentChunksResponse> {
    return this.documentsService.getChunks(id);
  }

  @Post(":id/ingest")
  ingest(@Param("id") id: string): Promise<SupportDocument> {
    return this.documentsService.ingest(id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string): Promise<void> {
    return this.documentsService.remove(id);
  }
}
