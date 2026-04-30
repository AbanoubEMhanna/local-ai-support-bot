# Local AI Support Bot

A local-first customer support bot SaaS that answers questions from uploaded knowledge base content such as FAQs, PDFs, Markdown files, and internal documentation.

The project is designed to showcase a production-style RAG system using a modern full-stack architecture while running entirely on local models through Ollama or LM Studio.

## Problem

Support teams often repeat the same answers across tickets, chats, and onboarding conversations. This app turns company documentation into an assistant that can answer customer questions with source citations, without sending private data to paid external AI APIs.

## Key Features

- Upload support documents, FAQs, PDFs, and Markdown files.
- Parse, chunk, embed, and index knowledge base content.
- Ask questions through a support chat UI.
- Return grounded answers with source citations.
- Store conversation history and document ingestion status.
- Run locally with Qwen 3 or Llama 3.1.

## Current Milestone

The app now has a working local RAG MVP:

- Next.js web app in `apps/web`.
- NestJS API in `apps/api`.
- Shared TypeScript contracts in `packages/shared`.
- Local AI provider abstraction in `packages/ai`.
- Prisma DB package in `packages/db`.
- Docker Compose for PostgreSQL + pgvector and Redis.
- `/health` endpoint for runtime config.
- `/ai/chat` endpoint for local model chat through Ollama or LM Studio.
- Document upload for `.txt`, `.md`, and `.pdf`.
- Local text extraction, chunking, embeddings, and pgvector storage.
- RAG chat endpoint with citations.
- Conversation history persistence.
- AI metrics endpoint.
- Web dashboard for upload, document status, RAG chat, and citations.

## Tech Stack

- Web: Next.js, Tailwind CSS, shadcn/ui
- API: NestJS
- Database: PostgreSQL + pgvector
- ORM: Prisma
- Queue/cache: Redis + BullMQ
- AI runtime: Ollama or LM Studio
- Models: Qwen 3 or Llama 3.1
- Storage: local disk first, MinIO later
- Deployment: Docker Compose

## Architecture

```txt
apps/web      -> Admin UI, document upload, chat experience
apps/api      -> Auth, ingestion, retrieval, chat API
packages/ai   -> Local model clients, RAG pipeline, prompt templates
packages/db   -> Schema, migrations, repositories
packages/shared -> Shared types, DTOs, validation helpers
docker         -> Local infrastructure
docs           -> Architecture notes and roadmap
```

## Local-first AI

This project does not require an OpenAI key. The AI layer supports:

- Ollama for local model execution.
- LM Studio for OpenAI-compatible local inference.
- Local embedding models for vector search.

Configuration is controlled through environment variables:

```env
AI_PROVIDER=ollama
AI_CHAT_MODEL=llama3.1:8b
AI_EMBEDDING_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://localhost:11434
LM_STUDIO_BASE_URL=http://localhost:1234/v1
```

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start PostgreSQL + pgvector and Redis:

```bash
pnpm infra:up
```

The API applies the local development schema automatically on startup.

Start the API:

```bash
pnpm dev:api
```

Start the web app:

```bash
pnpm dev:web
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`

Before sending a chat request, make sure either Ollama or LM Studio is running locally and the configured model is available.

Try the demo document:

```bash
curl -F "title=Demo Support Knowledge Base" \
  -F "file=@docs/demo-support.md;type=text/markdown" \
  http://localhost:4000/documents/upload
```

Then ask:

```bash
curl http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"provider":"ollama","model":"llama3.1:8b","message":"How can customers get setup help?"}'
```

## Scripts

- `pnpm dev`: run workspace dev scripts in parallel.
- `pnpm dev:api`: run the NestJS API on port `4000`.
- `pnpm dev:web`: run the Next.js app on port `3000`.
- `pnpm build`: build all workspace projects.
- `pnpm typecheck`: typecheck all workspace projects.
- `pnpm infra:up`: start local PostgreSQL + Redis.
- `pnpm infra:down`: stop local infrastructure.
- `pnpm db:generate`: generate Prisma client.

## Roadmap

- Phase 1: Scaffold Next.js, NestJS, PostgreSQL, pgvector, Redis. Done.
- Phase 2: Implement document upload, parsing, chunking, and embeddings. Done.
- Phase 3: Add RAG chat with citations and conversation history. Done.
- Phase 4: Add background ingestion jobs, auth, workspaces, RBAC, and evaluation datasets.

## Repository Status

This repository now has a runnable local RAG MVP. See `PLAN.md` for the full implementation plan and next milestones.
