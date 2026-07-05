"use client";

import type { Job } from "./types";

export async function requestAgent(
  job: Job,
): Promise<{ ok: boolean; analysis?: string; coverLetter?: string; error?: string; status?: number }> {
  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const data = (await res.json()) as { analysis?: string; coverLetter?: string; error?: string };
    return {
      ok: res.ok,
      analysis: data.analysis,
      coverLetter: data.coverLetter,
      error: data.error,
      status: res.status,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function requestSkills(
  job: Job,
): Promise<{ ok: boolean; required?: string[]; have?: string[]; missing?: string[]; error?: string }> {
  try {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const data = (await res.json()) as { required?: string[]; have?: string[]; missing?: string[]; error?: string };
    return { ok: res.ok, required: data.required, have: data.have, missing: data.missing, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
