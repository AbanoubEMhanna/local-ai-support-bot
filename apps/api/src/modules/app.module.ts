import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { ChatModule } from "./chat/chat.module";
import { DocumentsModule } from "./documents/documents.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";

@Module({
  imports: [HealthModule, AiModule, DocumentsModule, ChatModule, MetricsModule]
})
export class AppModule {}
