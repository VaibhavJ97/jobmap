import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAllSources } from "@/lib/sources";
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
});

export async function POST(request: Request) {
  const start = Date.now();

  // Protect the public endpoint from bot floods.
  const allowed = await allowRequest(clientIp(request));
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many searches — please wait a moment and try again." },
      { status: 429 },
    );
  }

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
  });
}
