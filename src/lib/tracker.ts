"use client";

import type { Job } from "./types";

// Anonymous per-browser id. In Phase 1c this is replaced by the signed-in
// user's id, but the storage key and API contract stay the same.
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("jobmap:uid");
  if (!id) {
    id = (crypto.randomUUID?.() ?? `u_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("jobmap:uid", id);
  }
  return id;
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json", "x-user-id": getUserId() };
}

export async function fetchSaved(): Promise<Job[]> {
  try {
    const res = await fetch("/api/tracker", { headers: headers() });
    const data = (await res.json()) as { saved?: Job[] };
    return data.saved ?? [];
  } catch {
    return [];
  }
}

export async function saveJob(job: Job): Promise<boolean> {
  try {
    const res = await fetch("/api/tracker", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ job }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeJob(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/tracker?jobId=${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
