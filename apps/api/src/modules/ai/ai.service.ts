import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createAiClient, loadAiConfig } from "@local-ai-support-bot/ai";
import type { ChatRequest, ChatResponse } from "@local-ai-support-bot/shared";

@Injectable()
export class AiService {
  async chat(input: ChatRequest): Promise<ChatResponse> {
    const config = loadAiConfig({
      ...process.env,
      AI_PROVIDER: input.provider || process.env.AI_PROVIDER,
      AI_CHAT_MODEL: input.model || process.env.AI_CHAT_MODEL
    });
    const client = createAiClient(config);

    try {
      const result = await client.generateText({
        messages: input.messages,
        model: input.model,
        temperature: input.temperature
      });

      return {
        provider: result.provider,
        model: result.model,
        content: result.content,
        latencyMs: result.latencyMs
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown local AI error";
      throw new InternalServerErrorException(message);
    }
  }
}

