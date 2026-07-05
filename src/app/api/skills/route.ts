import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSql, ensureSchema, ensureCvSchema } from "@/lib/db";
import { allowAi } from "@/lib/rateLimit";
import { generate, matchAnalysisPrompt } from "@/lib/llm";
import { skillGap } from "@/lib/skills";
import { resolveDescription } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  job: z
    .object({
      id: z.string().optional().default(""),
      title: z.string().optional().default(""),
      company: z.string().optional().default(""),
      location: z.string().optional().default(""),
      description: z.string().optional().default(""),
      source: z.string().optional().default(""),
      url: z.string().optional().default(""),
      refId: z.string().optional().default(""),
    })
    .passthrough(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to compare skills." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { job } = parsed.data;

  await ensureSchema();
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Comparison unavailable." }, { status: 503 });

  // Load the CV (required) and its timestamp (for the cache key).
  let cvText = "";
  let stamp = 0;
  try {
    await ensureCvSchema();
    const rows = await sql`SELECT cv_text, created_at FROM user_cv WHERE user_id = ${userId}`;
    if (rows[0]?.cv_text) {
      cvText = rows[0].cv_text as string;
      stamp = new Date(rows[0].created_at as string).getTime();
    }
  } catch {
    /* handled below */
  }
  if (!cvText) {
    return NextResponse.json({ error: "Upload your CV first to compare skills." }, { status: 400 });
  }

  // Real description on demand (Arbeitsagentur ships empty at search time).
  const description = await resolveDescription(job.source ?? "", job.url ?? "", job.description ?? "", job.refId ?? "");
  const fullJob = { ...job, description };

  const cacheKey = `match:${userId}:${stamp}:${job.id}`;

  // Cache first - a repeat check costs zero quota.
  try {
    const rows = await sql`SELECT content FROM ai_cache WHERE cache_key = ${cacheKey}`;
    if (rows[0]?.content) {
      return NextResponse.json({ mode: "ai", analysis: rows[0].content as string, cached: true });
    }
  } catch {
    /* fall through */
  }

  // AI path is rate-limited. If the user is out of quota, fall back to the
  // instant keyword comparison so the button still returns something useful.
  const allowed = await allowAi(userId);
  if (!allowed) {
    const jobText = `${fullJob.title ?? ""} ${(description || "").replace(/<[^>]+>/g, " ")}`;
    const gap = skillGap(jobText, cvText);
    return NextResponse.json({ mode: "keyword", ...gap, note: "AI limit reached (5/hour); showing a quick keyword check." });
  }

  try {
    const analysis = await generate(matchAnalysisPrompt(fullJob, cvText));
    try {
      await sql`
        INSERT INTO ai_cache (cache_key, content) VALUES (${cacheKey}, ${analysis})
        ON CONFLICT (cache_key) DO NOTHING
      `;
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ mode: "ai", analysis, cached: false });
  } catch {
    // If the model call fails, degrade to the keyword check rather than error.
    const jobText = `${fullJob.title ?? ""} ${(description || "").replace(/<[^>]+>/g, " ")}`;
    const gap = skillGap(jobText, cvText);
    return NextResponse.json({ mode: "keyword", ...gap });
  }
}
