import type { AiProvider, ChatMessage } from "@local-ai-support-bot/shared";

export interface AiClientConfig {
  provider: AiProvider;
  chatModel: string;
  embeddingModel: string;
  ollamaBaseUrl: string;
  lmStudioBaseUrl: string;
}

export interface GenerateTextInput {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
}

export interface GenerateTextResult {
  content: string;
  model: string;
  provider: AiProvider;
  latencyMs: number;
}

export interface GenerateEmbeddingResult {
  embedding: number[];
  model: string;
  provider: AiProvider;
  latencyMs: number;
}

export interface AiClient {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateEmbedding(input: string): Promise<GenerateEmbeddingResult>;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  response?: string;
}

interface LmStudioChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface EmbeddingResponse {
  embedding?: number[];
  embeddings?: number[][];
  data?: Array<{
    embedding?: number[];
  }>;
}

export function createAiClient(config: AiClientConfig): AiClient {
  return config.provider === "lmstudio"
    ? new LmStudioClient(config)
    : new OllamaClient(config);
}

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiClientConfig {
  const provider = normalizeProvider(env.AI_PROVIDER);

  return {
    provider,
    chatModel: env.AI_CHAT_MODEL || "llama3.1:8b",
    embeddingModel: env.AI_EMBEDDING_MODEL || "llama3.1:8b",
    ollamaBaseUrl: trimTrailingSlash(env.OLLAMA_BASE_URL || "http://localhost:11434"),
    lmStudioBaseUrl: trimTrailingSlash(env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1")
  };
}

class OllamaClient implements AiClient {
  constructor(private readonly config: AiClientConfig) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const model = input.model || this.config.chatModel;
    const response = await fetch(`${this.config.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: input.messages,
        stream: false,
        options: {
          temperature: input.temperature ?? 0.2
        }
      })
    });

    await assertOk(response, "Ollama chat request failed");
    const payload = (await response.json()) as OllamaChatResponse;
    const content = payload.message?.content || payload.response || "";

    return {
      provider: "ollama",
      model,
      content,
      latencyMs: Date.now() - startedAt
    };
  }

  async generateEmbedding(input: string): Promise<GenerateEmbeddingResult> {
    const startedAt = Date.now();
    const response = await fetch(`${this.config.ollamaBaseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        prompt: input
      })
    });

    await assertOk(response, "Ollama embedding request failed");
    const payload = (await response.json()) as EmbeddingResponse;
    const embedding = extractEmbedding(payload);

    return {
      provider: "ollama",
      model: this.config.embeddingModel,
      embedding,
      latencyMs: Date.now() - startedAt
    };
  }
}

class LmStudioClient implements AiClient {
  constructor(private readonly config: AiClientConfig) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const model = input.model || this.config.chatModel;
    const response = await fetch(`${this.config.lmStudioBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2
      })
    });

    await assertOk(response, "LM Studio chat request failed");
    const payload = (await response.json()) as LmStudioChatResponse;
    const content = payload.choices?.[0]?.message?.content || "";

    return {
      provider: "lmstudio",
      model,
      content,
      latencyMs: Date.now() - startedAt
    };
  }

  async generateEmbedding(input: string): Promise<GenerateEmbeddingResult> {
    const startedAt = Date.now();
    const response = await fetch(`${this.config.lmStudioBaseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input
      })
    });

    await assertOk(response, "LM Studio embedding request failed");
    const payload = (await response.json()) as EmbeddingResponse;
    const embedding = extractEmbedding(payload);

    return {
      provider: "lmstudio",
      model: this.config.embeddingModel,
      embedding,
      latencyMs: Date.now() - startedAt
    };
  }
}

function normalizeProvider(value?: string): AiProvider {
  return value?.toLowerCase() === "lmstudio" ? "lmstudio" : "ollama";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function extractEmbedding(payload: EmbeddingResponse): number[] {
  const embedding = payload.embedding || payload.embeddings?.[0] || payload.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Embedding response did not include a vector");
  }
  return embedding;
}

async function assertOk(response: Response, message: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text().catch(() => "");
  throw new Error(`${message}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
}
