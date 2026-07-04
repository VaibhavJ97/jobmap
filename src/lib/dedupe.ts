import type { Job } from "./types";

const LEGAL = /\b(gmbh|ag|ltd|limited|inc|llc|s\.r\.o\.|s\.a\.|srl|bv|nv|oy|ab|as|plc|ug|kg|kft|spa|sarl)\b\.?/gi;

function normalizeCompany(name: string): string {
  return (name ?? "").toLowerCase().replace(LEGAL, "").replace(/\s+/g, " ").trim();
}

// Source priority: lower number wins when the same job appears twice.
const PRIORITY: Record<string, number> = {
  ARBEITSAGENTUR: 1,
  ARBEITNOW: 2,
  REMOTIVE: 3,
};

export function deduplicate(jobs: Job[]): Job[] {
  const seen = new Map<string, Job>();
  for (const job of jobs) {
    const key = `${job.title.toLowerCase().trim()}|${normalizeCompany(job.company)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, job);
      continue;
    }
    if (job.sourceLabel !== existing.sourceLabel && !existing.alsoOn.includes(job.sourceLabel)) {
      existing.alsoOn.push(job.sourceLabel);
    }
    const better = (PRIORITY[job.source] ?? 99) < (PRIORITY[existing.source] ?? 99);
    if (better) {
      job.alsoOn = existing.alsoOn;
      if (!job.alsoOn.includes(existing.sourceLabel)) job.alsoOn.push(existing.sourceLabel);
      seen.set(key, job);
    }
  }
  return Array.from(seen.values());
}
