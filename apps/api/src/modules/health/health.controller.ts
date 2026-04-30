import { Controller, Get } from "@nestjs/common";
import { loadAiConfig } from "@local-ai-support-bot/ai";
import type { HealthResponse } from "@local-ai-support-bot/shared";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    const config = loadAiConfig();

    return {
      ok: true,
      service: "local-ai-support-bot-api",
      ai: {
        provider: config.provider,
        chatModel: config.chatModel,
        embeddingModel: config.embeddingModel
      }
    };
  }
}

