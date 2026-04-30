# Local AI Support Bot - Implementation Plan

## Goal

Build a local-first support bot SaaS that answers customer questions from uploaded company knowledge such as FAQs, PDFs, Markdown files, and internal docs.

All AI features must run through local models using Ollama or LM Studio. No OpenAI, Anthropic, Gemini, or paid remote AI API is required.

## Stack

- Web: Next.js
- API: NestJS
- DB: PostgreSQL + pgvector
- ORM: Prisma
- AI: Ollama or LM Studio
- Default local model: `llama3.1:8b`
- Storage: local filesystem under `storage/`
- Runtime: Docker Compose

## Completed Features

- [x] Monorepo setup using `pnpm workspaces`.
- [x] Next.js web app in `apps/web`.
- [x] NestJS API in `apps/api`.
- [x] Shared contracts in `packages/shared`.
- [x] Local AI abstraction in `packages/ai`.
- [x] Ollama chat provider.
- [x] LM Studio chat provider.
- [x] Local embedding support through the AI abstraction.
- [x] Prisma DB package in `packages/db`.
- [x] PostgreSQL + pgvector schema for workspaces, documents, chunks, conversations, messages, and AI metrics.
- [x] Automatic idempotent schema application on API startup.
- [x] Docker Compose for PostgreSQL + pgvector and Redis.
- [x] `GET /health`.
- [x] `POST /ai/chat` for direct local model testing.
- [x] `POST /documents/upload`.
- [x] `GET /documents`.
- [x] `GET /documents/:id`.
- [x] `DELETE /documents/:id`.
- [x] `POST /documents/:id/ingest`.
- [x] `GET /documents/:id/chunks`.
- [x] Text extraction for `.txt`, `.md`, and `.pdf`.
- [x] Chunking service for uploaded document text.
- [x] Local embeddings with Ollama/LM Studio.
- [x] Store embeddings in PostgreSQL with pgvector.
- [x] Similarity search over document chunks.
- [x] `POST /chat` RAG endpoint.
- [x] Answers with citations.
- [x] Conversation persistence.
- [x] `GET /conversations`.
- [x] `GET /conversations/:id`.
- [x] `GET /metrics/ai`.
- [x] Documents dashboard in the web app.
- [x] Upload and ingestion UI.
- [x] RAG chat UI.
- [x] Citation display in the web app.
- [x] Basic AI metrics display.
- [x] Demo support knowledge document in `docs/demo-support.md`.
- [x] Vitest test runner.
- [x] AI provider unit tests with mocked `fetch`.
- [x] Document extraction and chunking tests.
- [x] NestJS/Supertest API smoke tests.
- [x] PostgreSQL + pgvector DB integration tests.
- [x] GitHub Actions CI workflow.
- [x] Husky `pre-push` hook.
- [x] Local CI pipeline script: `pnpm run ci`.
- [x] `pnpm typecheck` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] End-to-end local RAG verified with Ollama `llama3.1:8b`.

## Remaining Features

- [ ] Replace synchronous ingestion with Redis/BullMQ background jobs.
- [ ] Add ingestion progress events and retry controls.
- [ ] Add better PDF extraction edge-case handling.
- [ ] Add workspace/team UI.
- [ ] Add basic auth.
- [ ] Add RBAC: owner/admin/member.
- [ ] Add document search and filters in the dashboard.
- [ ] Add conversation picker/history UI.
- [ ] Add delete conversation endpoint and UI.
- [ ] Add source preview modal for citations.
- [ ] Add model/provider settings screen.
- [ ] Add evaluation dataset for support questions.
- [ ] Add broader API tests for upload failures, delete, re-ingest, and conversation detail.
- [ ] Add e2e browser tests.
- [ ] Add screenshots and demo GIFs for GitHub.

## Current API

- `GET /health`
- `POST /ai/chat`
- `POST /documents/upload`
- `GET /documents`
- `GET /documents/:id`
- `DELETE /documents/:id`
- `POST /documents/:id/ingest`
- `GET /documents/:id/chunks`
- `POST /chat`
- `GET /conversations`
- `GET /conversations/:id`
- `GET /metrics/ai`

## Next Milestone

Implement BullMQ-based ingestion:

- Upload returns quickly with status `UPLOADED`.
- A worker processes extraction, chunking, embedding, and pgvector storage.
- The web app polls or subscribes to ingestion status.
- Failed ingestion jobs can be retried from the dashboard.

## Acceptance Criteria

- A user can upload a Markdown/text/PDF document.
- The system extracts text, chunks it, embeds it locally, and stores vectors in pgvector.
- A user can ask a question and receive a grounded answer with citations.
- The system runs locally with Ollama or LM Studio only.
- `pnpm typecheck` and `pnpm build` pass.
