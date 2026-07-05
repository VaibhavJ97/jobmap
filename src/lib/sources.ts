import type { Job } from "./types";

// Greenhouse company slugs with EU tech presence. Inlined (rather than a
// separate JSON file) so there is nothing extra to import or upload. Add a
// company by finding the {slug} in its Greenhouse careers URL and listing it.
const GREENHOUSE_SLUGS = [
  "spotify",
  "wise",
  "personio",
  "getyourguide",
  "contentful",
  "hellofresh",
  "deepl",
  "celonis",
  "traderepublic",
  "n26",
  "bolt",
  "pipedrive",
  "klarna",
  "deliveryhero",
  "babbel",
  "trivago",
  "freenow",
  "sennder",
  "forto",
  "gitlab",
];

function sha(input: string): string {
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
  } catch {
    warnings.push(`${label}: unavailable this search`);
    return [];
  }
}

// Fetch with a hard timeout so one slow source cannot blow the serverless budget.
async function fetchT(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const UA = { "User-Agent": "jobmap/0.1" };

// ---- Region + language classification (so filters have data to work on) ----

const DE = ["germany", "deutschland", "berlin", "munich", "munchen", "m\u00fcnchen", "hamburg", "frankfurt", "cologne", "koln", "k\u00f6ln", "stuttgart", "dusseldorf", "d\u00fcsseldorf", "leipzig", "dortmund", "essen", "bremen", "dresden", "hannover", "nuremberg", "nurnberg", "n\u00fcrnberg", "karlsruhe", "mannheim", "bonn"];
const AT_CH = ["austria", "osterreich", "\u00f6sterreich", "switzerland", "schweiz", "vienna", "wien", "zurich", "z\u00fcrich", "basel", "geneva", "graz", "salzburg", "bern", "lausanne"];
const EU = ["netherlands", "amsterdam", "france", "paris", "spain", "madrid", "barcelona", "italy", "rome", "milan", "ireland", "dublin", "portugal", "lisbon", "poland", "warsaw", "sweden", "stockholm", "denmark", "copenhagen", "finland", "helsinki", "belgium", "brussels", "czech", "prague", "romania", "bucharest", "greece", "athens", "hungary", "budapest", "norway", "oslo", "estonia", "tallinn", "europe", "eu", "emea", "united kingdom", "london", "uk"];

export function classifyRegion(location: string, isRemote: boolean): "DE" | "DACH" | "EU" | "OTHER" {
  const s = (location || "").toLowerCase();
  if (DE.some((k) => s.includes(k))) return "DE";
  if (AT_CH.some((k) => s.includes(k))) return "DACH";
  if (EU.some((k) => s.includes(k))) return "EU";
  if (isRemote && /\b(worldwide|anywhere|global)\b/.test(s)) return "OTHER";
  return "OTHER";
}

// Rough language guess from common German tokens; defaults to English.
const DE_TOKENS = [" und ", " der ", " die ", " das ", " f\u00fcr ", " mit ", " wir ", " sie ", " deine", " unser", "entwickler", "mitarbeiter", "m/w/d", "w/m/d", "kenntnisse", "aufgaben", "stellenangebot"];
export function detectLang(title: string, description: string): "de" | "en" {
  const s = ` ${(title + " " + description).toLowerCase()} `;
  return DE_TOKENS.some((t) => s.includes(t)) ? "de" : "en";
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Decode the common HTML entities that some feeds return in plain-text fields
// (e.g. a title arriving as "Web Developer &amp; AI Specialist").
function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function enrich(j: Job): Job {
  const title = decodeEntities(j.title);
  const company = decodeEntities(j.company);
  const location = decodeEntities(j.location);
  return {
    ...j,
    title,
    company,
    location,
    region: classifyRegion(location, j.isRemote),
    lang: detectLang(title, j.description ?? ""),
  };
}

// --- Remotive ---------------------------------------------------------------
async function fetchRemotive(keyword: string): Promise<Job[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}&limit=40`;
  const res = await fetchT(url, { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { jobs?: any[] };
  return (data.jobs ?? []).map((j) =>
    enrich({
      id: makeId(j.title ?? "", j.company_name ?? ""),
      title: j.title ?? "",
      company: j.company_name ?? "Unknown",
      location: j.candidate_required_location ?? "Remote",
      url: j.url ?? "",
      source: "REMOTIVE",
      sourceLabel: "Remotive",
      isRemote: true,
      datePosted: j.publication_date ?? null,
      description: stripHtml(j.description ?? ""),
      alsoOn: [],
    }),
  );
}

// --- Arbeitnow --------------------------------------------------------------
async function fetchArbeitnow(keyword: string): Promise<Job[]> {
  const res = await fetchT("https://www.arbeitnow.com/api/job-board-api", { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { data?: any[] };
  const kw = keyword.toLowerCase();
  return (data.data ?? [])
    .filter((j) => `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase().includes(kw))
    .map((j) =>
      enrich({
        id: makeId(j.title ?? "", j.company_name ?? ""),
        title: j.title ?? "",
        company: j.company_name ?? "Unknown",
        location: j.location ?? "",
        url: j.url ?? "",
        source: "ARBEITNOW",
        sourceLabel: "Arbeitnow",
        isRemote: Boolean(j.remote),
        datePosted: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
        description: stripHtml(j.description ?? ""),
        alsoOn: [],
      }),
    );
}

// --- Arbeitsagentur ---------------------------------------------------------
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
    headers: { "X-API-Key": "jobboerse-jobsuche", ...UA },
    // @ts-expect-error undici dispatcher is not in the standard fetch types
    dispatcher,
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { stellenangebote?: any[] };
  return (data.stellenangebote ?? []).map((j) => {
    const ort = j.arbeitsort?.ort ?? "";
    const region = j.arbeitsort?.region ?? "";
    return enrich({
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
    });
  });
}

// --- Jobicy: remote roles, clean JSON API, no key ---------------------------
async function fetchJobicy(keyword: string): Promise<Job[]> {
  const url = `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(keyword)}`;
  const res = await fetchT(url, { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { jobs?: any[] };
  return (data.jobs ?? []).map((j) =>
    enrich({
      id: makeId(j.jobTitle ?? "", j.companyName ?? ""),
      title: j.jobTitle ?? "",
      company: j.companyName ?? "Unknown",
      location: j.jobGeo ?? "Remote",
      url: j.url ?? "",
      source: "JOBICY",
      sourceLabel: "Jobicy",
      isRemote: true,
      datePosted: j.pubDate ?? null,
      description: stripHtml(j.jobExcerpt ?? ""),
      alsoOn: [],
    }),
  );
}

// --- Remote OK: public JSON feed (first element is a legal notice) ----------
async function fetchRemoteOk(keyword: string): Promise<Job[]> {
  const res = await fetchT("https://remoteok.com/api", { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const arr = (await res.json()) as any[];
  const kw = keyword.toLowerCase();
  return (Array.isArray(arr) ? arr : [])
    .filter((j) => j && j.position)
    .filter((j) => `${j.position ?? ""} ${(j.tags ?? []).join(" ")} ${j.description ?? ""}`.toLowerCase().includes(kw))
    .slice(0, 40)
    .map((j) =>
      enrich({
        id: makeId(j.position ?? "", j.company ?? ""),
        title: j.position ?? "",
        company: j.company ?? "Unknown",
        location: j.location || "Remote",
        url: j.url ?? "",
        source: "REMOTEOK",
        sourceLabel: "Remote OK",
        isRemote: true,
        datePosted: j.date ?? null,
        description: stripHtml(j.description ?? ""),
        alsoOn: [],
      }),
    );
}

// --- We Work Remotely: public RSS feed (light XML parse, no dep) -------------
function rssField(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}
async function fetchWWR(keyword: string): Promise<Job[]> {
  const res = await fetchT("https://weworkremotely.com/remote-jobs.rss", { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const xml = await res.text();
  const kw = keyword.toLowerCase();
  const items = xml.split(/<item>/i).slice(1).map((s) => s.split(/<\/item>/i)[0]);
  const out: Job[] = [];
  for (const it of items) {
    const rawTitle = rssField(it, "title"); // often "Company: Role"
    const link = rssField(it, "link");
    const region = rssField(it, "region");
    const desc = stripHtml(rssField(it, "description"));
    let company = "Unknown";
    let title = rawTitle;
    const colon = rawTitle.indexOf(":");
    if (colon > 0) {
      company = rawTitle.slice(0, colon).trim();
      title = rawTitle.slice(colon + 1).trim();
    }
    if (!`${title} ${desc}`.toLowerCase().includes(kw)) continue;
    out.push(
      enrich({
        id: makeId(title, company),
        title,
        company,
        location: region || "Remote",
        url: link,
        source: "WWR",
        sourceLabel: "We Work Remotely",
        isRemote: true,
        datePosted: rssField(it, "pubDate") || null,
        description: desc,
        alsoOn: [],
      }),
    );
    if (out.length >= 40) break;
  }
  return out;
}

// --- Greenhouse: per-company public JSON API, EU-located jobs only ----------
async function fetchGreenhouseCompany(slug: string, keyword: string): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetchT(url, { headers: UA }, 5000);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { jobs?: any[] };
  const kw = keyword.toLowerCase();
  return (data.jobs ?? [])
    .filter((j) => `${j.title ?? ""} ${stripHtml(j.content ?? "")}`.toLowerCase().includes(kw))
    .map((j) => {
      const loc = j.location?.name ?? "";
      const isRemote = /remote/i.test(loc);
      return enrich({
        id: makeId(j.title ?? "", slug),
        title: j.title ?? "",
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        url: j.absolute_url ?? "",
        source: "GREENHOUSE",
        sourceLabel: "Greenhouse",
        isRemote,
        datePosted: j.updated_at ?? null,
        description: stripHtml(j.content ?? "").slice(0, 1200),
        alsoOn: [],
      });
    })
    .filter((job) => job.region === "DE" || job.region === "DACH" || job.region === "EU"); // EU-located only
}

async function fetchGreenhouse(keyword: string, warnings: string[]): Promise<Job[]> {
  const slugs = GREENHOUSE_SLUGS;
  // Each company is independent; a dead slug just yields [] and is dropped.
  const batches = await Promise.all(
    slugs.map((slug) =>
      fetchGreenhouseCompany(slug, keyword).catch(() => [] as Job[]),
    ),
  );
  const jobs = batches.flat();
  if (jobs.length === 0) warnings.push("Greenhouse: no EU matches this search");
  return jobs;
}

export async function fetchAllSources(keyword: string, location: string, warnings: string[]): Promise<Job[]> {
  const batches = await Promise.all([
    safe("Remotive", () => fetchRemotive(keyword), warnings),
    safe("Arbeitnow", () => fetchArbeitnow(keyword), warnings),
    safe("Arbeitsagentur", () => fetchArbeitsagentur(keyword, location), warnings),
    safe("Jobicy", () => fetchJobicy(keyword), warnings),
    safe("Remote OK", () => fetchRemoteOk(keyword), warnings),
    safe("We Work Remotely", () => fetchWWR(keyword), warnings),
    safe("Greenhouse", () => fetchGreenhouse(keyword, warnings), warnings),
  ]);
  return batches.flat();
}
