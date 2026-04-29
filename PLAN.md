# Local AI Support Bot - Implementation Plan

## Goal

Build a local-first support bot SaaS that answers customer questions from uploaded company knowledge such as FAQs, PDFs, Markdown files, and internal docs.

## Stack

- Web: Next.js, Tailwind CSS, shadcn/ui
- API: NestJS
- DB: PostgreSQL + pgvector
- Queue/cache: Redis + BullMQ
- AI: Ollama or LM Studio
- Models: Qwen 3 or Llama 3.1
- Storage: local disk first, MinIO later
- Runtime: Docker Compose

## Phase 1 - Foundation

- Scaffold `apps/web` with Next.js.
- Scaffold `apps/api` with NestJS.
- Add shared TypeScript config and common package conventions.
- Add Docker Compose for PostgreSQL, pgvector, and Redis.
- Add health check endpoints and environment config.

## Phase 2 - Knowledge Ingestion

- Add document upload from the web app.
- Parse PDF, Markdown, and plain text documents.
- Chunk documents and store chunks in PostgreSQL.
- Generate local embeddings and store them with pgvector.
- Add ingestion job status using BullMQ.

## Phase 3 - Chat Experience

- Add chat endpoint that retrieves relevant chunks.
- Generate answers through Ollama or LM Studio.
- Return source citations with each answer.
- Save conversations and messages.
- Add admin UI for uploaded documents and chat history.

## Phase 4 - SaaS Polish

- Add auth, workspaces, and basic roles.
- Add usage analytics and model latency metrics.
- Add evaluation dataset for common support questions.
- Add README screenshots and deployment notes.

## Acceptance Criteria

- A user can upload docs, wait for ingestion, and ask questions.
- Answers include citations from uploaded documents.
- The system runs locally without OpenAI keys.
- Docker Compose starts all required services.

