import type { Job, SearchPrefs } from "./types";

// Every weight in one place - tune behaviour here. Mirrors the Python engine.
const W = {
  titleAll: 45,
  titleExact: 20,
  titleStarts: 12,
  titlePartial: 18,
  descAll: 12,
  descPartial: 6,
  fresh24: 18,
  fresh3d: 12,
  fresh7d: 6,
  fresh14d: 2,
  workModel: 8,
  country: 6,
  multiSource: 5,
  hasCompany: 3,
  hasLocation: 2,
  noKeyword: -40,
};

const SYNONYMS: Record<string, string[]> = {
  freelance: ["freelance", "contractor", "contract", "b2b", "werkvertrag", "freiberuflich"],
  contract: ["contract", "contractor", "freelance", "b2b", "werkvertrag"],
  remote: ["remote", "homeoffice", "home office", "distributed"],
  hybrid: ["hybrid", "homeoffice", "home office", "mobiles arbeiten"],
  "part-time": ["part-time", "part time", "teilzeit", "parttime"],
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").toLowerCase();
}

function parts(keywords: string): string[] {
  return keywords
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function partMatches(part: string, haystack: string): boolean {
  const syns = SYNONYMS[part] ?? [part];
  if (syns.some((s) => haystack.includes(s))) return true;
  const tokens = part.split(/\s+/);
  return tokens.length > 1 && tokens.every((t) => haystack.includes(t));
}

const CEILING =
  W.titleAll + W.titleExact + W.titleStarts + W.fresh24 + W.workModel + W.country + W.multiSource + W.hasCompany + W.hasLocation;

function scoreJob(job: Job, keywords: string, prefs: SearchPrefs, now: number): number {
  const title = (job.title ?? "").toLowerCase();
  const desc = stripHtml(job.description ?? "");
  const ps = parts(keywords);
  const primary = ps[0] ?? "";
  let raw = 0;

  if (ps.length) {
    const titleHits = ps.filter((p) => partMatches(p, title)).length;
    const frac = titleHits / ps.length;
    if (frac === 1) raw += W.titleAll;
    else if (frac > 0) raw += W.titlePartial * frac;

    if (primary && title.includes(primary)) {
      raw += W.titleExact;
      if (title.startsWith(primary)) raw += W.titleStarts;
    }

    const titleFull = ps.every((p) => partMatches(p, title));
    if (!titleFull) {
      const descHits = ps.filter((p) => partMatches(p, desc)).length;
      const dfrac = descHits / ps.length;
      if (dfrac === 1) raw += W.descAll;
      else if (dfrac > 0) raw += W.descPartial * dfrac;
    }
    if (!ps.some((p) => partMatches(p, title) || partMatches(p, desc))) raw += W.noKeyword;
  }

  if (job.datePosted) {
    const t = Date.parse(job.datePosted);
    if (!Number.isNaN(t)) {
      const ageH = (now - t) / 3_600_000;
      if (ageH <= 24) raw += W.fresh24;
      else if (ageH <= 72) raw += W.fresh3d;
      else if (ageH <= 168) raw += W.fresh7d;
      else if (ageH <= 336) raw += W.fresh14d;
    }
  }

  const wm = new Set(prefs.workModels);
  if (wm.size) {
    const onsite = !job.isRemote;
    if ((wm.has("remote") && job.isRemote) || (wm.has("onsite") && onsite)) raw += W.workModel;
  }

  if (job.alsoOn?.length) raw += W.multiSource;
  const company = (job.company ?? "").trim().toLowerCase();
  if (company && !["", "unknown", "-", "\u2013"].includes(company)) raw += W.hasCompany;
  if ((job.location ?? "").trim()) raw += W.hasLocation;

  return Math.round(Math.max(0, Math.min(1, raw / CEILING)) * 100);
}

function label(score: number): "strong" | "good" | "weak" {
  if (score >= 70) return "strong";
  if (score >= 40) return "good";
  return "weak";
}

export function rankJobs(jobs: Job[], keywords: string, prefs: SearchPrefs): Job[] {
  const now = Date.now();
  for (const j of jobs) {
    j.relevance = scoreJob(j, keywords, prefs, now);
    j.match = label(j.relevance);
  }
  jobs.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || (b.datePosted ?? "").localeCompare(a.datePosted ?? ""));
  return jobs;
}
