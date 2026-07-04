import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAllSources } from "@/lib/sources";
import { deduplicate } from "@/lib/dedupe";
import { rankJobs } from "@/lib/ranking";
import { geocode } from "@/lib/geocode";
import type { WorkModel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SearchSchema = z.object({
  keywords: z.string().min(1, "keywords required").max(120),
  location: z.string().max(80).optional().default(""),
  workModels: z.array(z.enum(["remote", "hybrid", "onsite"])).optional().default(["remote", "hybrid", "onsite"]),
  countries: z.array(z.string()).optional().default([]),
});

export async function POST(request: Request) {
  const start = Date.now();
  const body = await request.json().catch(() => ({}));
  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const { keywords, location, workModels, countries } = parsed.data;

  const warnings: string[] = [];
  const raw = await fetchAllSources(keywords.split(",")[0].trim(), location, warnings);

  let jobs = deduplicate(raw);

  // Work-model filter (Phase 1 supports remote/onsite from source flags).
  const wm = new Set<WorkModel>(workModels);
  if (wm.size && wm.size < 3) {
    jobs = jobs.filter((j) => (wm.has("remote") && j.isRemote) || (wm.has("onsite") && !j.isRemote) || wm.has("hybrid"));
  }

  // Attach coordinates for the map.
  for (const j of jobs) {
    const g = geocode(j.location);
    if (g) {
      j.lat = g.lat;
      j.lng = g.lng;
      j.city = g.city;
    }
  }

  jobs = rankJobs(jobs, keywords, { workModels, countries });

  return NextResponse.json({
    results: jobs,
    total: jobs.length,
    durationSeconds: Math.round((Date.now() - start) / 100) / 10,
    warnings,
  });
}
