import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import type { GetConversationResponse, ListConversationsResponse, RagChatRequest, RagChatResponse } from "@local-ai-support-bot/shared";
import { ChatService } from "./chat.service";

@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post("chat")
  chat(@Body() body: RagChatRequest): Promise<RagChatResponse> {
    return this.chatService.chat(body);
  }

  @Get("conversations")
  conversations(): Promise<ListConversationsResponse> {
    return this.chatService.listConversations();
  }

  @Get("conversations/:id")
  conversation(@Param("id") id: string): Promise<GetConversationResponse> {
    return this.chatService.getConversation(id);
  }
}
