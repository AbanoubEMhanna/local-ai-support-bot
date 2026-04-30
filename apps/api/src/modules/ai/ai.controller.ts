import { Body, Controller, HttpException, HttpStatus, Inject, Post } from "@nestjs/common";
import type { ChatRequest, ChatResponse } from "@local-ai-support-bot/shared";
import { AiService } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Post("chat")
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new HttpException("messages must include at least one message", HttpStatus.BAD_REQUEST);
    }

    const invalidMessage = body.messages.find((message) => {
      return !message || !["system", "user", "assistant"].includes(message.role) || !message.content?.trim();
    });

    if (invalidMessage) {
      throw new HttpException("each message must include role and content", HttpStatus.BAD_REQUEST);
    }

    return this.aiService.chat(body);
  }
}
