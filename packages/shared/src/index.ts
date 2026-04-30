export type AiProvider = "ollama" | "lmstudio";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: AiProvider;
  temperature?: number;
}

export interface ChatResponse {
  provider: AiProvider;
  model: string;
  content: string;
  latencyMs: number;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  ai: {
    provider: AiProvider;
    chatModel: string;
    embeddingModel: string;
  };
}

export type DocumentStatus = "UPLOADED" | "INGESTING" | "READY" | "FAILED";

export interface SupportDocument {
  id: string;
  title: string;
  filename: string;
  contentType: string;
  status: DocumentStatus;
  chunkCount: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  score?: number;
}

export interface UploadDocumentResponse {
  document: SupportDocument;
}

export interface ListDocumentsResponse {
  documents: SupportDocument[];
}

export interface GetDocumentChunksResponse {
  chunks: DocumentChunk[];
}

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface RagChatRequest {
  message: string;
  conversationId?: string;
  provider?: AiProvider;
  model?: string;
  temperature?: number;
}

export interface RagChatResponse {
  conversationId: string;
  answer: string;
  citations: Citation[];
  provider: AiProvider;
  model: string;
  latencyMs: number;
  retrievalCount: number;
}

export interface ConversationMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface GetConversationResponse {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface ListConversationsResponse {
  conversations: ConversationSummary[];
}

export interface AiMetricsResponse {
  totalRequests: number;
  averageLatencyMs: number;
  averageRetrievalCount: number;
  latest: Array<{
    id: string;
    provider: AiProvider;
    model: string;
    latencyMs: number;
    retrievalCount: number;
    createdAt: string;
  }>;
}
