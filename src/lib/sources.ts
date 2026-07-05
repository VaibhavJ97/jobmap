import type { Job } from "./types";

// Greenhouse company slugs with EU tech presence. Inlined (rather than a
// separate JSON file) so there is nothing extra to import or upload. Add a
// company by finding the {slug} in its Greenhouse careers URL and listing it.
// One combined company roster. Each entry names which ATS hosts it, so adding
// a company is a one-line change and adding a whole ATS is a new "ats" value.
// NOTE: every company here is queried on EVERY search (no cap, by request).
// If searches start creeping toward Vercel's ~10s limit (watch the "X jobs in
// Ys" readout), trim this list. Grow or shrink freely; nothing else changes.
type AtsKind = "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "smartrecruiters";
type RosterEntry = { ats: AtsKind; slug: string };

const COMPANY_ROSTER: RosterEntry[] = [
  // Greenhouse
  { ats: "greenhouse", slug: "spotify" },
  { ats: "greenhouse", slug: "wise" },
  { ats: "greenhouse", slug: "personio" },
  { ats: "greenhouse", slug: "getyourguide" },
  { ats: "greenhouse", slug: "contentful" },
  { ats: "greenhouse", slug: "hellofresh" },
  { ats: "greenhouse", slug: "deepl" },
  { ats: "greenhouse", slug: "celonis" },
  { ats: "greenhouse", slug: "traderepublic" },
  { ats: "greenhouse", slug: "n26" },
  { ats: "greenhouse", slug: "bolt" },
  { ats: "greenhouse", slug: "pipedrive" },
  { ats: "greenhouse", slug: "klarna" },
  { ats: "greenhouse", slug: "deliveryhero" },
  { ats: "greenhouse", slug: "babbel" },
  { ats: "greenhouse", slug: "trivago" },
  { ats: "greenhouse", slug: "freenow" },
  { ats: "greenhouse", slug: "sennder" },
  { ats: "greenhouse", slug: "forto" },
  { ats: "greenhouse", slug: "gitlab" },
  // Lever
  { ats: "lever", slug: "personio" },
  { ats: "lever", slug: "gympass" },
  { ats: "lever", slug: "taxfix" },
  { ats: "lever", slug: "mollie" },
  { ats: "lever", slug: "tier" },
  { ats: "lever", slug: "sumup" },
  { ats: "lever", slug: "wefox" },
  // Ashby
  { ats: "ashby", slug: "ramp" },
  { ats: "ashby", slug: "linear" },
  { ats: "ashby", slug: "runway" },
  { ats: "ashby", slug: "posthog" },
  { ats: "ashby", slug: "supabase" },
  { ats: "ashby", slug: "trunk" },
  // Workable
  { ats: "workable", slug: "kaiko" },
  { ats: "workable", slug: "boostcom" },
  { ats: "workable", slug: "hometogo" },
  // Recruitee (common among European SMB/mid-market)
  { ats: "recruitee", slug: "recruitee" },
  { ats: "recruitee", slug: "gigsalad" },
  { ats: "recruitee", slug: "usercentrics" },
  { ats: "recruitee", slug: "choco" },
  { ats: "recruitee", slug: "grover" },
  // SmartRecruiters (enterprise; many EU offices)
  { ats: "smartrecruiters", slug: "Bosch" },
  { ats: "smartrecruiters", slug: "Visa" },
  { ats: "smartrecruiters", slug: "Ubisoft" },
  { ats: "smartrecruiters", slug: "IKEA" },
  { ats: "smartrecruiters", slug: "Biontech" },
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
    // Include location so genuinely different postings that share a title and
    // company (common on Arbeitsagentur) do not collapse into one during
    // dedupe, while cross-board copies of the same job (same title, company
    // and city) still merge into a single card.
    id: makeId(`${title}|${location}`, company),
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
// Extract the Arbeitsagentur reference number from a job detail URL.
export function arbeitsagenturRefnr(url: string): string {
  const m = (url || "").match(/jobdetail\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// Fetch ONE Arbeitsagentur job's full description on demand (used by Check
// match / Draft), so search stays fast and only clicked jobs cost a request.
export async function fetchArbeitsagenturDescription(refnr: string): Promise<string> {
  if (!refnr) return "";
  const enc = Buffer.from(refnr).toString("base64");
  const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/${enc}`;
  let dispatcher: unknown;
  try {
    const { Agent } = await import("undici");
    dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  } catch {
    dispatcher = undefined;
  }
  try {
    const res = await fetch(url, {
      headers: { "X-API-Key": "jobboerse-jobsuche", ...UA },
      // @ts-expect-error undici dispatcher is not in the standard fetch types
      dispatcher,
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { stellenbeschreibung?: string };
    return stripHtml(data.stellenbeschreibung ?? "");
  } catch {
    return "";
  }
}

// Given a job's source/url/refId/existing text, return a usable description,
// lazily fetching it for Arbeitsagentur (which ships empty at search time).
export async function resolveDescription(
  source: string,
  url: string,
  existing: string,
  refId?: string,
): Promise<string> {
  if (existing && existing.trim()) return existing;
  if (source === "ARBEITSAGENTUR") {
    const ref = refId && refId.trim() ? refId : arbeitsagenturRefnr(url);
    return await fetchArbeitsagenturDescription(ref);
  }
  return existing ?? "";
}

async function fetchArbeitsagentur(keyword: string, location: string, page = 1): Promise<Job[]> {
  const params = new URLSearchParams({ was: keyword, angebotsart: "1", size: "100", page: String(page), pav: "false" });
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
      refId: j.refnr ?? "",
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

// --- Recruitee: public offers API, per company subdomain, no key ------------
async function fetchRecruiteeCompany(slug: string, keyword: string): Promise<Job[]> {
  const res = await fetchT(`https://${slug}.recruitee.com/api/offers/`, { headers: UA }, 5000);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { offers?: any[] };
  const kw = keyword.toLowerCase();
  return (data.offers ?? [])
    .filter((j) => `${j.title ?? ""} ${stripHtml(j.description ?? "")}`.toLowerCase().includes(kw))
    .map((j) => {
      const loc = [j.city, j.country].filter(Boolean).join(", ");
      return enrich({
        id: makeId(j.title ?? "", slug),
        title: j.title ?? "",
        company: j.company_name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        url: j.careers_url ?? j.url ?? "",
        source: "RECRUITEE",
        sourceLabel: "Recruitee",
        isRemote: /remote/i.test(loc) || /remote/i.test(j.remote ? "remote" : ""),
        datePosted: j.published_at ?? null,
        description: stripHtml(j.description ?? "").slice(0, 1200),
        alsoOn: [],
      });
    })
    .filter((job) => job.region === "DE" || job.region === "DACH" || job.region === "EU");
}

// --- SmartRecruiters: public Posting API, per company, no key ---------------
async function fetchSmartRecruitersCompany(slug: string, keyword: string, offset = 0): Promise<Job[]> {
  const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings?q=${encodeURIComponent(keyword)}&limit=40&offset=${offset}`;
  const res = await fetchT(url, { headers: UA }, 5000);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { content?: any[] };
  return (data.content ?? [])
    .map((j) => {
      const loc = [j.location?.city, j.location?.region, j.location?.country]
        .filter(Boolean)
        .join(", ");
      return enrich({
        id: makeId(j.name ?? "", slug),
        title: j.name ?? "",
        company: j.company?.name ?? slug,
        location: loc,
        url: j.ref ?? `https://jobs.smartrecruiters.com/${slug}`,
        source: "SMARTRECRUITERS",
        sourceLabel: "SmartRecruiters",
        isRemote: Boolean(j.location?.remote),
        datePosted: j.releasedDate ?? null,
        description: "",
        alsoOn: [],
      });
    })
    .filter((job) => job.region === "DE" || job.region === "DACH" || job.region === "EU");
}

// Roster dispatcher: fires EVERY company in COMPANY_ROSTER in parallel (no cap).
// A dead slug or failed fetch just yields [] and is dropped, so one bad company
// never breaks a search.
async function fetchRoster(keyword: string, warnings: string[]): Promise<Job[]> {
  const runners: Record<AtsKind, (slug: string, kw: string) => Promise<Job[]>> = {
    greenhouse: fetchGreenhouseCompany,
    lever: fetchLeverCompany,
    ashby: fetchAshbyCompany,
    workable: fetchWorkableCompany,
    recruitee: fetchRecruiteeCompany,
    smartrecruiters: fetchSmartRecruitersCompany,
  };
  const batches = await Promise.all(
    COMPANY_ROSTER.map((entry) =>
      runners[entry.ats](entry.slug, keyword).catch(() => [] as Job[]),
    ),
  );
  const jobs = batches.flat();
  if (jobs.length === 0) warnings.push("Company boards: no EU matches this search");
  return jobs;
}

// --- Lever: public postings API, per company, no key ------------------------
async function fetchLeverCompany(slug: string, keyword: string): Promise<Job[]> {
  const res = await fetchT(`https://api.lever.co/v0/postings/${slug}?mode=json`, { headers: UA }, 5000);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const arr = (await res.json()) as any[];
  const kw = keyword.toLowerCase();
  return (Array.isArray(arr) ? arr : [])
    .filter((j) => `${j.text ?? ""} ${stripHtml(j.descriptionPlain ?? j.description ?? "")}`.toLowerCase().includes(kw))
    .map((j) => {
      const loc = j.categories?.location ?? "";
      return enrich({
        id: makeId(j.text ?? "", slug),
        title: j.text ?? "",
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        url: j.hostedUrl ?? j.applyUrl ?? "",
        source: "LEVER",
        sourceLabel: "Lever",
        isRemote: /remote/i.test(loc) || /remote/i.test(j.categories?.commitment ?? ""),
        datePosted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        description: stripHtml(j.descriptionPlain ?? j.description ?? "").slice(0, 1200),
        alsoOn: [],
      });
    })
    .filter((job) => job.region === "DE" || job.region === "DACH" || job.region === "EU");
}

// --- Ashby: public job-board posting API, per company, no key ---------------
async function fetchAshbyCompany(slug: string, keyword: string): Promise<Job[]> {
  const res = await fetchT(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, { headers: UA }, 5000);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { jobs?: any[] };
  const kw = keyword.toLowerCase();
  return (data.jobs ?? [])
    .filter((j) => `${j.title ?? ""} ${stripHtml(j.descriptionPlain ?? "")}`.toLowerCase().includes(kw))
    .map((j) => {
      const country = j.address?.postalAddress?.addressCountry ?? "";
      const loc = j.location ?? [country].filter(Boolean).join(", ");
      return enrich({
        id: makeId(j.title ?? "", slug),
        title: j.title ?? "",
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        url: j.jobUrl ?? j.applyUrl ?? "",
        source: "ASHBY",
        sourceLabel: "Ashby",
        isRemote: Boolean(j.isRemote) || /remote/i.test(j.workplaceType ?? ""),
        datePosted: j.publishedAt ?? null,
        description: stripHtml(j.descriptionPlain ?? "").slice(0, 1200),
        alsoOn: [],
      });
    })
    .filter((job) => job.region === "DE" || job.region === "DACH" || job.region === "EU");
}

// --- Workable: public widget account API, per company, no key ---------------
async function fetchWorkableCompany(slug: string, keyword: string): Promise<Job[]> {
  const res = await fetchT(`https://apply.workable.com/api/v1/widget/accounts/${slug}`, { headers: UA }, 5000);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { jobs?: any[]; name?: string };
  const kw = keyword.toLowerCase();
  const company = data.name ?? slug;
  return (data.jobs ?? [])
    .filter((j) => `${j.title ?? ""} ${stripHtml(j.description ?? "")}`.toLowerCase().includes(kw))
    .map((j) => {
      const loc = [j.city, j.country].filter(Boolean).join(", ");
      return enrich({
        id: makeId(j.title ?? "", slug),
        title: j.title ?? "",
        company,
        location: loc,
        url: j.url ?? j.application_url ?? "",
        source: "WORKABLE",
        sourceLabel: "Workable",
        isRemote: Boolean(j.remote) || /remote/i.test(loc),
        datePosted: j.published_on ?? null,
        description: stripHtml(j.description ?? "").slice(0, 1200),
        alsoOn: [],
      });
    })
    .filter((job) => job.region === "DE" || job.region === "DACH" || job.region === "EU");
}

// --- The Muse: public API, no key -------------------------------------------
async function fetchTheMuse(keyword: string): Promise<Job[]> {
  const url = `https://www.themuse.com/api/public/jobs?page=1`;
  const res = await fetchT(url, { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { results?: any[] };
  const kw = keyword.toLowerCase();
  return (data.results ?? [])
    .filter((j) => `${j.name ?? ""} ${stripHtml(j.contents ?? "")}`.toLowerCase().includes(kw))
    .map((j) => {
      const loc = (j.locations ?? []).map((l: any) => l.name).join(", ");
      return enrich({
        id: makeId(j.name ?? "", j.company?.name ?? ""),
        title: j.name ?? "",
        company: j.company?.name ?? "Unknown",
        location: loc,
        url: j.refs?.landing_page ?? "",
        source: "THEMUSE",
        sourceLabel: "The Muse",
        isRemote: /remote|flexible/i.test(loc),
        datePosted: j.publication_date ?? null,
        description: stripHtml(j.contents ?? "").slice(0, 1200),
        alsoOn: [],
      });
    });
}

// --- Adzuna: aggregator, needs a free app id + key (skipped if unset) -------
async function fetchAdzuna(keyword: string): Promise<Job[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return []; // no key configured -> silently skip
  const url =
    `https://api.adzuna.com/v1/api/jobs/de/search/1?app_id=${id}&app_key=${key}` +
    `&results_per_page=40&what=${encodeURIComponent(keyword)}&content-type=application/json`;
  const res = await fetchT(url, { headers: UA });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { results?: any[] };
  return (data.results ?? []).map((j) =>
    enrich({
      id: makeId(j.title ?? "", j.company?.display_name ?? ""),
      title: (j.title ?? "").replace(/<[^>]+>/g, ""),
      company: j.company?.display_name ?? "Unknown",
      location: j.location?.display_name ?? "",
      url: j.redirect_url ?? "",
      source: "ADZUNA",
      sourceLabel: "Adzuna",
      isRemote: /remote/i.test(j.location?.display_name ?? ""),
      datePosted: j.created ?? null,
      description: stripHtml(j.description ?? "").slice(0, 1200),
      alsoOn: [],
    }),
  );
}

export async function fetchAllSources(keyword: string, location: string, warnings: string[]): Promise<Job[]> {
  const batches = await Promise.all([
    safe("Remotive", () => fetchRemotive(keyword), warnings),
    safe("Arbeitnow", () => fetchArbeitnow(keyword), warnings),
    safe("Arbeitsagentur", () => fetchArbeitsagentur(keyword, location, 1), warnings),
    safe("Jobicy", () => fetchJobicy(keyword), warnings),
    safe("Remote OK", () => fetchRemoteOk(keyword), warnings),
    safe("We Work Remotely", () => fetchWWR(keyword), warnings),
    safe("Company boards", () => fetchRoster(keyword, warnings), warnings),
    safe("The Muse", () => fetchTheMuse(keyword), warnings),
    safe("Adzuna", () => fetchAdzuna(keyword), warnings),
  ]);
  return batches.flat();
}

// Load-more: only the sources that actually paginate return genuinely new
// jobs (the feeds already gave everything on page 0). page is 1-based here.
export async function fetchMore(
  keyword: string,
  location: string,
  warnings: string[],
  page: number,
): Promise<Job[]> {
  const srCompanies = COMPANY_ROSTER.filter((e) => e.ats === "smartrecruiters");
  const batches = await Promise.all([
    // Arbeitsagentur: next page (page 0 fetched page 1, so add 1).
    safe("Arbeitsagentur", () => fetchArbeitsagentur(keyword, location, page + 1), warnings),
    // SmartRecruiters: next offset across the SR roster companies.
    ...srCompanies.map((e) =>
      safe(`SmartRecruiters ${e.slug}`, () => fetchSmartRecruitersCompany(e.slug, keyword, page * 40), warnings),
    ),
  ]);
  return batches.flat();
}
