import { Injectable, NotFoundException } from "@nestjs/common";
import { createAiClient, loadAiConfig } from "@local-ai-support-bot/ai";
import {
  addConversationMessage,
  createConversation,
  getConversation,
  listConversations,
  recordAiMetric,
  searchDocumentChunks
} from "@local-ai-support-bot/db";
import type { GetConversationResponse, ListConversationsResponse, RagChatRequest, RagChatResponse } from "@local-ai-support-bot/shared";

@Injectable()
export class ChatService {
  async chat(input: RagChatRequest): Promise<RagChatResponse> {
    const trimmedMessage = input.message?.trim();
    if (!trimmedMessage) {
      throw new Error("message is required");
    }

    const config = loadAiConfig({
      ...process.env,
      AI_PROVIDER: input.provider || process.env.AI_PROVIDER,
      AI_CHAT_MODEL: input.model || process.env.AI_CHAT_MODEL
    });
    const client = createAiClient(config);
    const startedAt = Date.now();
    const questionEmbedding = await client.generateEmbedding(trimmedMessage);
    const citations = await searchDocumentChunks(questionEmbedding.embedding, 5);
    const conversationId = input.conversationId || await createConversation({ title: createConversationTitle(trimmedMessage) });

    await addConversationMessage({
      conversationId,
      role: "user",
      content: trimmedMessage
    });

    const context = citations.map((citation, index) => {
      return `[${index + 1}] ${citation.documentTitle} / chunk ${citation.chunkIndex + 1}\n${citation.content}`;
    }).join("\n\n");

    const systemPrompt = [
      "You are a customer support assistant.",
      "Answer only using the provided context.",
      "If the context does not contain enough information, say that you do not know based on the uploaded documents.",
      "When you use a source, cite it inline like [1] or [2]."
    ].join(" ");

    const userPrompt = citations.length > 0
      ? `Context:\n${context}\n\nQuestion:\n${trimmedMessage}`
      : `No relevant uploaded document context was found.\n\nQuestion:\n${trimmedMessage}`;

    const generated = await client.generateText({
      model: input.model,
      temperature: input.temperature ?? 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    const latencyMs = Date.now() - startedAt;

    await addConversationMessage({
      conversationId,
      role: "assistant",
      content: generated.content,
      citations
    });

    await recordAiMetric({
      provider: generated.provider,
      model: generated.model,
      latencyMs,
      retrievalCount: citations.length
    });

    return {
      conversationId,
      answer: generated.content,
      citations,
      provider: generated.provider,
      model: generated.model,
      latencyMs,
      retrievalCount: citations.length
    };
  }

  async listConversations(): Promise<ListConversationsResponse> {
    return { conversations: await listConversations() };
  }

  async getConversation(id: string): Promise<GetConversationResponse> {
    const conversation = await getConversation(id);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    return conversation;
  }
}

function createConversationTitle(message: string): string {
  return message.length > 60 ? `${message.slice(0, 57)}...` : message;
}

