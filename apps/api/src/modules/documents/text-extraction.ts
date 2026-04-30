import pdfParse from "pdf-parse";

export async function extractTextFromFile(input: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<string> {
  const filename = input.filename.toLowerCase();
  const contentType = input.contentType.toLowerCase();

  if (contentType.includes("pdf") || filename.endsWith(".pdf")) {
    const result = await pdfParse(input.buffer);
    return normalizeText(result.text);
  }

  if (
    contentType.startsWith("text/") ||
    contentType.includes("markdown") ||
    filename.endsWith(".md") ||
    filename.endsWith(".txt")
  ) {
    return normalizeText(input.buffer.toString("utf8"));
  }

  throw new Error("Unsupported file type. Upload .txt, .md, or .pdf files.");
}

export function assertSupportedDocumentFile(input: { filename: string; contentType: string }): void {
  const filename = input.filename.toLowerCase();
  const contentType = input.contentType.toLowerCase();

  if (
    contentType.includes("pdf") ||
    contentType.startsWith("text/") ||
    contentType.includes("markdown") ||
    filename.endsWith(".pdf") ||
    filename.endsWith(".md") ||
    filename.endsWith(".txt")
  ) {
    return;
  }

  throw new Error("Unsupported file type. Upload .txt, .md, or .pdf files.");
}

export function chunkText(text: string, maxChars = 1200, overlapChars = 160): Array<{ content: string; chunkIndex: number; tokenCount: number }> {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if (`${current}\n\n${paragraph}`.length <= maxChars) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    const overlap = current.slice(Math.max(0, current.length - overlapChars));
    current = `${overlap}\n\n${paragraph}`.trim();
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => splitOversizedChunk(chunk, maxChars)).map((content, chunkIndex) => ({
    content,
    chunkIndex,
    tokenCount: estimateTokenCount(content)
  }));
}

function splitOversizedChunk(chunk: string, maxChars: number): string[] {
  if (chunk.length <= maxChars) {
    return [chunk];
  }

  const chunks: string[] = [];
  for (let index = 0; index < chunk.length; index += maxChars) {
    chunks.push(chunk.slice(index, index + maxChars).trim());
  }
  return chunks.filter(Boolean);
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}
