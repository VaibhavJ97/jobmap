"use client";

import type { Job } from "./types";

// Cookies (the Auth.js session) are sent automatically on same-origin fetches,
// so no manual id header is needed anymore.

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

export async function emailJob(job: Job): Promise<{ ok: boolean; to?: string; error?: string }> {
  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const data = (await res.json()) as { ok?: boolean; to?: string; error?: string };
    return { ok: res.ok, to: data.to, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
