import { describe, expect, it } from "vitest";
import { assertSupportedDocumentFile, chunkText, extractTextFromFile } from "./text-extraction";

describe("extractTextFromFile", () => {
  it("extracts text from Markdown files", async () => {
    const text = await extractTextFromFile({
      buffer: Buffer.from("# Help\r\n\r\nUse local AI only."),
      filename: "support.md",
      contentType: "text/markdown"
    });

    expect(text).toBe("# Help\n\nUse local AI only.");
  });

  it("extracts text from plain text files", async () => {
    const text = await extractTextFromFile({
      buffer: Buffer.from("Setup   help\n\n\nNo paid AI APIs."),
      filename: "support.txt",
      contentType: "text/plain"
    });

    expect(text).toBe("Setup help\n\nNo paid AI APIs.");
  });

  it("rejects unsupported file types", async () => {
    await expect(extractTextFromFile({
      buffer: Buffer.from("{}"),
      filename: "support.json",
      contentType: "application/json"
    })).rejects.toThrow("Unsupported file type");
  });

  it("validates supported file metadata before background ingestion", () => {
    expect(() => assertSupportedDocumentFile({ filename: "support.md", contentType: "application/octet-stream" })).not.toThrow();
    expect(() => assertSupportedDocumentFile({ filename: "support.json", contentType: "application/json" })).toThrow("Unsupported file type");
  });
});

describe("chunkText", () => {
  it("splits long text and assigns stable chunk indexes", () => {
    const chunks = chunkText([
      "Paragraph one has useful setup instructions.",
      "Paragraph two explains the local AI policy.",
      "Paragraph three explains citations and retrieval."
    ].join("\n\n"), 75, 10);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(chunks.map((_, index) => index));
    expect(chunks.every((chunk) => chunk.content.length <= 75)).toBe(true);
    expect(chunks.every((chunk) => chunk.tokenCount > 0)).toBe(true);
  });

  it("returns no chunks for empty text", () => {
    expect(chunkText(" \n\n ")).toEqual([]);
  });
});
