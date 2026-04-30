"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  AiMetricsResponse,
  AiProvider,
  Citation,
  HealthResponse,
  ListDocumentsResponse,
  RagChatResponse,
  SupportDocument
} from "@local-ai-support-bot/shared";
import styles from "./page.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Home() {
  const [provider, setProvider] = useState<AiProvider>("ollama");
  const [model, setModel] = useState("llama3.1:8b");
  const [documents, setDocuments] = useState<SupportDocument[]>([]);
  const [metrics, setMetrics] = useState<AiMetricsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("How can customers get setup help?");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  async function refreshDashboard() {
    setError("");
    const [healthResponse, documentsResponse, metricsResponse] = await Promise.all([
      fetch(`${API_URL}/health`),
      fetch(`${API_URL}/documents`),
      fetch(`${API_URL}/metrics/ai`)
    ]);

    if (healthResponse.ok) {
      const payload = (await healthResponse.json()) as HealthResponse;
      setHealth(payload);
      setProvider(payload.ai.provider);
      setModel(payload.ai.chatModel);
    }

    if (documentsResponse.ok) {
      const payload = (await documentsResponse.json()) as ListDocumentsResponse;
      setDocuments(payload.documents);
    }

    if (metricsResponse.ok) {
      setMetrics((await metricsResponse.json()) as AiMetricsResponse);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a .txt, .md, or .pdf file first.");
      return;
    }

    setIsUploading(true);
    setError("");
    setStatus("Uploading and ingesting document...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Upload failed");
      }

      setSelectedFile(null);
      setTitle("");
      setStatus(`Document saved with status ${payload.document.status}.`);
      await refreshDashboard();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function reingestDocument(documentId: string) {
    setError("");
    setStatus("Re-ingesting document...");
    const response = await fetch(`${API_URL}/documents/${documentId}/ingest`, { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.message || "Re-ingest failed");
      return;
    }

    setStatus(`Document status is ${payload.status}.`);
    await refreshDashboard();
  }

  async function deleteDocument(documentId: string) {
    setError("");
    const response = await fetch(`${API_URL}/documents/${documentId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.message || "Delete failed");
      return;
    }

    setStatus("Document deleted.");
    await refreshDashboard();
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }

    setIsChatting(true);
    setError("");
    setAnswer("");
    setCitations([]);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          conversationId,
          message: question
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Chat failed");
      }

      const result = payload as RagChatResponse;
      setAnswer(result.answer);
      setCitations(result.citations);
      setConversationId(result.conversationId);
      setStatus(`Answered with ${result.retrievalCount} retrieved chunks in ${result.latencyMs}ms.`);
      await refreshDashboard();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Chat failed");
    } finally {
      setIsChatting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Local AI Support Bot</h1>
          <p className={styles.subtitle}>
            Upload support docs, index them with local embeddings, and ask grounded questions through Ollama or LM Studio.
          </p>
        </div>

        <section className={styles.statusPanel} aria-label="Runtime status">
          <h2 className={styles.statusTitle}>Runtime</h2>
          <dl className={styles.statusList}>
            <div className={styles.statusRow}>
              <dt>API</dt>
              <dd className={styles.statusValue}>{API_URL}</dd>
            </div>
            <div className={styles.statusRow}>
              <dt>Provider</dt>
              <dd className={styles.statusValue}>{health?.ai.provider || provider}</dd>
            </div>
            <div className={styles.statusRow}>
              <dt>Model</dt>
              <dd className={styles.statusValue}>{health?.ai.chatModel || model}</dd>
            </div>
            <div className={styles.statusRow}>
              <dt>AI requests</dt>
              <dd className={styles.statusValue}>{metrics?.totalRequests ?? 0}</dd>
            </div>
          </dl>
        </section>
      </header>

      <section className={styles.grid}>
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Documents</h2>
              <p className={styles.panelCopy}>Upload `.txt`, `.md`, or `.pdf` files. Ingestion stores local embeddings in pgvector.</p>
            </div>

            <form className={styles.form} onSubmit={uploadDocument}>
              <label className={styles.field}>
                <span className={styles.label}>Title</span>
                <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional display title" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>File</span>
                <input
                  className={styles.input}
                  type="file"
                  accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className={styles.button} type="submit" disabled={isUploading}>
                {isUploading ? "Ingesting..." : "Upload and ingest"}
              </button>
            </form>

            <div className={styles.documentList}>
              {documents.length === 0 ? <p className={styles.empty}>No documents uploaded yet.</p> : null}
              {documents.map((document) => (
                <article className={styles.documentItem} key={document.id}>
                  <div>
                    <h3 className={styles.documentTitle}>{document.title}</h3>
                    <p className={styles.documentMeta}>
                      {document.status} · {document.chunkCount} chunks · {document.filename}
                    </p>
                    {document.errorMessage ? <p className={styles.error}>{document.errorMessage}</p> : null}
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.secondaryButton} type="button" onClick={() => void reingestDocument(document.id)}>
                      Re-ingest
                    </button>
                    <button className={styles.dangerButton} type="button" onClick={() => void deleteDocument(document.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>RAG chat</h2>
            <p className={styles.panelCopy}>Questions retrieve relevant document chunks before the local model answers.</p>
          </div>

          <form className={styles.form} onSubmit={submitQuestion}>
            <div className={styles.inlineFields}>
              <label className={styles.field}>
                <span className={styles.label}>Provider</span>
                <select className={styles.select} value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)}>
                  <option value="ollama">Ollama</option>
                  <option value="lmstudio">LM Studio</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Model</span>
                <input className={styles.input} value={model} onChange={(event) => setModel(event.target.value)} />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Question</span>
              <textarea className={styles.textarea} value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>

            <button className={styles.button} type="submit" disabled={isChatting}>
              {isChatting ? "Generating..." : "Ask documents"}
            </button>
          </form>

          <div className={styles.answer}>
            <div className={styles.answerBox}>{answer || "Upload a document, then ask a support question."}</div>
            {citations.length > 0 ? (
              <div className={styles.citations}>
                <h3 className={styles.citationsTitle}>Citations</h3>
                {citations.map((citation, index) => (
                  <article className={styles.citation} key={citation.chunkId}>
                    <strong>[{index + 1}] {citation.documentTitle}</strong>
                    <span>Score: {citation.score.toFixed(3)} · Chunk {citation.chunkIndex + 1}</span>
                    <p>{citation.content}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </section>

      {status || error ? (
        <footer className={styles.footerStatus}>
          {status ? <span>{status}</span> : null}
          {error ? <span className={styles.error}>{error}</span> : null}
        </footer>
      ) : null}
    </main>
  );
}

