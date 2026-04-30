CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  error_message TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  embedding vector NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  retrieval_count INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_workspace_id_idx ON document_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS conversations_workspace_id_idx ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_metrics_workspace_id_idx ON ai_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS ai_metrics_created_at_idx ON ai_metrics(created_at);
