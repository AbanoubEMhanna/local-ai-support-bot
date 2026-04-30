import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiClient, loadAiConfig } from "./index";

describe("loadAiConfig", () => {
  it("uses local Ollama defaults", () => {
    const config = loadAiConfig({});

    expect(config).toMatchObject({
      provider: "ollama",
      chatModel: "llama3.1:8b",
      embeddingModel: "llama3.1:8b",
      ollamaBaseUrl: "http://localhost:11434",
      lmStudioBaseUrl: "http://localhost:1234/v1"
    });
  });

  it("normalizes LM Studio and trims base URLs", () => {
    const config = loadAiConfig({
      AI_PROVIDER: "lmstudio",
      AI_CHAT_MODEL: "qwen3:latest",
      AI_EMBEDDING_MODEL: "qwen3:4b",
      OLLAMA_BASE_URL: "http://localhost:11434/",
      LM_STUDIO_BASE_URL: "http://localhost:1234/v1/"
    });

    expect(config).toMatchObject({
      provider: "lmstudio",
      chatModel: "qwen3:latest",
      embeddingModel: "qwen3:4b",
      ollamaBaseUrl: "http://localhost:11434",
      lmStudioBaseUrl: "http://localhost:1234/v1"
    });
  });
});

describe("AI clients", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Ollama chat requests with the configured model and temperature", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "hello" } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createAiClient(loadAiConfig({ AI_PROVIDER: "ollama", AI_CHAT_MODEL: "llama3.1:8b" }));
    const result = await client.generateText({
      temperature: 0.4,
      messages: [{ role: "user", content: "Hi" }]
    });

    expect(result.content).toBe("hello");
    expect(result.provider).toBe("ollama");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434/api/chat", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        model: "llama3.1:8b",
        messages: [{ role: "user", content: "Hi" }],
        stream: false,
        options: { temperature: 0.4 }
      })
    }));
  });

  it("parses LM Studio chat completion responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "local answer" } }] }), { status: 200 })
    ));

    const client = createAiClient(loadAiConfig({ AI_PROVIDER: "lmstudio", AI_CHAT_MODEL: "qwen3:latest" }));
    const result = await client.generateText({
      messages: [{ role: "user", content: "Hi" }]
    });

    expect(result).toMatchObject({
      provider: "lmstudio",
      model: "qwen3:latest",
      content: "local answer"
    });
  });

  it("extracts embeddings from OpenAI-compatible responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
    ));

    const client = createAiClient(loadAiConfig({ AI_PROVIDER: "lmstudio", AI_EMBEDDING_MODEL: "embed-local" }));
    const result = await client.generateEmbedding("hello");

    expect(result).toMatchObject({
      provider: "lmstudio",
      model: "embed-local",
      embedding: [0.1, 0.2, 0.3]
    });
  });

  it("throws a useful error when an embedding response has no vector", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    ));

    const client = createAiClient(loadAiConfig({ AI_PROVIDER: "lmstudio" }));

    await expect(client.generateEmbedding("hello")).rejects.toThrow("Embedding response did not include a vector");
  });
});

