"use client";

import type { Job } from "./types";

export type SkillsResult = {
  ok: boolean;
  mode?: "ai" | "keyword";
  have?: string[];
  missing?: string[];
  fit?: string;
  note?: string;
  error?: string;
  status?: number;
};

export async function requestSkills(job: Job): Promise<SkillsResult> {
  try {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const data = (await res.json()) as Omit<SkillsResult, "ok" | "status">;
    return { ok: res.ok, status: res.status, ...data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
