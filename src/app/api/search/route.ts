import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAllSources, fetchMore } from "@/lib/sources";
import { deduplicate } from "@/lib/dedupe";
import { rankJobs } from "@/lib/ranking";
import { geocode } from "@/lib/geocode";
import { geocodeBatch } from "@/lib/geocodeCache";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import type { WorkModel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SearchSchema = z.object({
  keywords: z.string().min(1, "keywords required").max(120),
  location: z.string().max(80).optional().default(""),
  workModels: z.array(z.enum(["remote", "hybrid", "onsite"])).optional().default(["remote", "hybrid", "onsite"]),
  countries: z.array(z.string()).optional().default([]),
  page: z.number().int().min(0).optional().default(0),
});

export async function POST(request: Request) {
  const start = Date.now();

  // Protect the public endpoint from bot floods.
  const allowed = await allowRequest(clientIp(request));
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many searches - please wait a moment and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const { keywords, location, workModels, countries, page } = parsed.data;

  const warnings: string[] = [];
  const kw = keywords.split(",")[0].trim();
  const raw =
    page > 0
      ? await fetchMore(kw, location, warnings, page)
      : await fetchAllSources(kw, location, warnings);

  let jobs = deduplicate(raw);

  // Work-model filter (Phase 1 supports remote/onsite from source flags).
  const wm = new Set<WorkModel>(workModels);
  if (wm.size && wm.size < 3) {
    jobs = jobs.filter((j) => (wm.has("remote") && j.isRemote) || (wm.has("onsite") && !j.isRemote) || wm.has("hybrid"));
  }

  // Attach coordinates for the map.
  const unlocated: typeof jobs = [];
  for (const j of jobs) {
    const g = geocode(j.location);
    if (g) {
      j.lat = g.lat;
      j.lng = g.lng;
      j.city = g.city;
    } else if (j.location) {
      unlocated.push(j);
    }
  }

  // Fallback: resolve cities not in the static table via cached Nominatim.
  if (unlocated.length) {
    const coords = await geocodeBatch(unlocated.map((j) => j.location));
    for (const j of unlocated) {
      const c = coords.get(j.location.trim());
      if (c) {
        j.lat = c.lat;
        j.lng = c.lng;
        j.city = c.city;
      }
    }
  }

  jobs = rankJobs(jobs, keywords, { workModels, countries });

  return NextResponse.json({
    results: jobs,
    total: jobs.length,
    durationSeconds: Math.round((Date.now() - start) / 100) / 10,
    warnings,
    // Hint for the client: if a paginated page came back non-empty, there may
    // be more. The feeds are exhausted on page 0, so this reflects Arbeitsagentur
    // and SmartRecruiters depth.
    hasMore: page > 0 ? jobs.length > 0 : true,
  });
}
