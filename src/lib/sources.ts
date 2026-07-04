import type { Job } from "./types";

function sha(input: string): string {
  // Small stable id from title+company (no crypto import needed).
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function makeId(title: string, company: string): string {
  return sha(`${title}|${company}`.toLowerCase());
}

async function safe<T>(label: string, fn: () => Promise<Job[]>, warnings: string[]): Promise<Job[]> {
  try {
    return await fn();
  } catch (e) {
    warnings.push(`${label}: unavailable this search`);
    return [];
  }
}

// --- Remotive: remote roles, clean JSON API, no key ---------------------
async function fetchRemotive(keyword: string): Promise<Job[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}&limit=40`;
  const res = await fetch(url, { headers: { "User-Agent": "jobmap/0.1" } });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { jobs?: any[] };
  return (data.jobs ?? []).map((j) => ({
    id: makeId(j.title ?? "", j.company_name ?? ""),
    title: j.title ?? "",
    company: j.company_name ?? "Unknown",
    location: j.candidate_required_location ?? "Remote",
    url: j.url ?? "",
    source: "REMOTIVE",
    sourceLabel: "Remotive",
    isRemote: true,
    datePosted: j.publication_date ?? null,
    description: j.description ?? "",
    alsoOn: [],
  }));
}

// --- Arbeitnow: DACH board, no search param (filtered locally) ----------
async function fetchArbeitnow(keyword: string): Promise<Job[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { "User-Agent": "jobmap/0.1" } });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { data?: any[] };
  const kw = keyword.toLowerCase();
  return (data.data ?? [])
    .filter((j) => `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase().includes(kw))
    .map((j) => ({
      id: makeId(j.title ?? "", j.company_name ?? ""),
      title: j.title ?? "",
      company: j.company_name ?? "Unknown",
      location: j.location ?? "",
      url: j.url ?? "",
      source: "ARBEITNOW",
      sourceLabel: "Arbeitnow",
      isRemote: Boolean(j.remote),
      datePosted: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
      description: j.description ?? "",
      alsoOn: [],
    }));
}

// --- Arbeitsagentur: whole German market, free public API ----------------
// Best-effort: its TLS cert can be flaky, so we tolerate failures. Uses an
// undici dispatcher to accept the cert; wrapped so a failure never blocks.
async function fetchArbeitsagentur(keyword: string, location: string): Promise<Job[]> {
  const params = new URLSearchParams({ was: keyword, angebotsart: "1", size: "40", pav: "false" });
  if (location) params.set("wo", location);
  const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/app/jobs?${params}`;

  let dispatcher: unknown;
  try {
    const { Agent } = await import("undici");
    dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  } catch {
    dispatcher = undefined;
  }

  const res = await fetch(url, {
    headers: { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "jobmap/0.1" },
    // @ts-expect-error undici dispatcher is not in the standard fetch types
    dispatcher,
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { stellenangebote?: any[] };
  return (data.stellenangebote ?? []).map((j) => {
    const ort = j.arbeitsort?.ort ?? "";
    const region = j.arbeitsort?.region ?? "";
    return {
      id: makeId(j.titel ?? j.beruf ?? "", j.arbeitgeber ?? ""),
      title: j.titel ?? j.beruf ?? "",
      company: j.arbeitgeber ?? "Unknown",
      location: [ort, region].filter(Boolean).join(", "),
      url: j.externeUrl ?? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${j.refnr ?? ""}`,
      source: "ARBEITSAGENTUR",
      sourceLabel: "Arbeitsagentur",
      isRemote: false,
      datePosted: j.aktuelleVeroeffentlichungsdatum ?? null,
      description: "",
      alsoOn: [],
    };
  });
}

export async function fetchAllSources(keyword: string, location: string, warnings: string[]): Promise<Job[]> {
  const batches = await Promise.all([
    safe("Remotive", () => fetchRemotive(keyword), warnings),
    safe("Arbeitnow", () => fetchArbeitnow(keyword), warnings),
    safe("Arbeitsagentur", () => fetchArbeitsagentur(keyword, location), warnings),
  ]);
  return batches.flat();
}
