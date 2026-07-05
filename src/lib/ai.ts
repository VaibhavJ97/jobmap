"use client";

import type { Job } from "./types";

export async function requestAi(
  job: Job,
  kind: "summary" | "bullets",
): Promise<{ ok: boolean; content?: string; error?: string; status?: number; personalized?: boolean }> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, job }),
    });
    const data = (await res.json()) as { content?: string; error?: string; personalized?: boolean };
    return { ok: res.ok, content: data.content, error: data.error, status: res.status, personalized: data.personalized };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
