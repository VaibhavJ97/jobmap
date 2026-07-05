"use client";

import type { Job } from "./types";

export type MatchScore = { pct: number; band: string };

export async function matchJobs(
  jobs: Job[],
): Promise<{ ok: boolean; scores?: Record<string, MatchScore>; error?: string }> {
  try {
    const payload = jobs.slice(0, 40).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description ?? "",
    }));
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: payload }),
    });
    const data = (await res.json()) as { scores?: Record<string, MatchScore>; error?: string };
    return { ok: res.ok, scores: data.scores, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
