// Embedding helper - turns text into a vector using Gemini's embedding model.
// Used to store a CV embedding (Phase 3a) and, later, job embeddings for
// semantic matching (Phase 3b). Kept separate from llm.ts for clarity.

const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIM = 768;

export async function embed(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: EMBED_DIM,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? `embed status ${res.status}`);
    const values = data?.embedding?.values;
    if (!Array.isArray(values)) throw new Error("embed: no vector returned");
    return values as number[];
  } finally {
    clearTimeout(timer);
  }
}

// Format a JS number[] as a pgvector literal: "[0.1,0.2,...]"
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
