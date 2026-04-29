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

## Tech Stack

- Web: Next.js, Tailwind CSS, shadcn/ui
- API: NestJS
- Database: PostgreSQL + pgvector
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

This project does not require an OpenAI key. The AI layer should support:

- Ollama for local model execution.
- LM Studio for OpenAI-compatible local inference.
- Local embedding models for vector search.

## Roadmap

- Phase 1: Scaffold Next.js, NestJS, PostgreSQL, pgvector, Redis.
- Phase 2: Implement document upload, parsing, chunking, and embeddings.
- Phase 3: Add RAG chat with citations and conversation history.
- Phase 4: Add auth, workspaces, metrics, and evaluation datasets.

## Repository Status

This repository is currently a monorepo skeleton. See `PLAN.md` for the full implementation plan.
