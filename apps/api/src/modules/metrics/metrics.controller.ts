import { Controller, Get } from "@nestjs/common";
import { getAiMetrics } from "@local-ai-support-bot/db";
import type { AiMetricsResponse } from "@local-ai-support-bot/shared";

@Controller("metrics")
export class MetricsController {
  @Get("ai")
  getAiMetrics(): Promise<AiMetricsResponse> {
    return getAiMetrics();
  }
}

