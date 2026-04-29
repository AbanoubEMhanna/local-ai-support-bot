# Architecture

Local-first AI support bot SaaS architecture notes.

## Target Shape

- Web app for admins and support conversations.
- API for authentication, document ingestion, chat, and conversation history.
- AI package for LM Studio/Ollama adapters, prompt templates, and RAG orchestration.
- DB package for schema, migrations, and repository helpers.
- Docker setup for local services such as PostgreSQL, pgvector, Redis, and optional object storage.

