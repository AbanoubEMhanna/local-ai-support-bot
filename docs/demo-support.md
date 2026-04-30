# Demo Support Knowledge Base

## Setup Help

Customers can get setup help by opening the onboarding checklist, connecting their workspace, and uploading their first support document. If they get stuck, support should ask for the error message, browser, and the step where the issue happened.

## Local AI Policy

This product runs AI features locally through Ollama or LM Studio. It does not require OpenAI, Anthropic, Gemini, or any paid AI API key.

## Supported Documents

The support bot can ingest plain text files, Markdown files, and PDF documents. After upload, each document is parsed, chunked, embedded locally, and stored in PostgreSQL with pgvector.

## Troubleshooting

If answers do not include citations, confirm that the document status is READY and that the local embedding model is available. If ingestion fails, review the document error message in the dashboard.

