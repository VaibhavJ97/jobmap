"use client";

import type { Job } from "./types";

// Cookies (the Auth.js session) are sent automatically on same-origin fetches.

export async function fetchSaved(): Promise<{ saved: Job[]; authenticated: boolean }> {
  try {
    const res = await fetch("/api/tracker");
    const data = (await res.json()) as { saved?: Job[]; authenticated?: boolean };
    return { saved: data.saved ?? [], authenticated: Boolean(data.authenticated) };
  } catch {
    return { saved: [], authenticated: false };
  }
}

export async function saveJob(job: Job): Promise<boolean> {
  try {
    const res = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeJob(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/tracker?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
