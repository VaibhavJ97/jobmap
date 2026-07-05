import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSql, ensureCvSchema } from "@/lib/db";
import { allowAi } from "@/lib/rateLimit";
import { embed, toVectorLiteral } from "@/lib/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap how many jobs we score per click, to bound embedding calls and latency.
const MAX_JOBS = 40;

const Schema = z.object({
  jobs: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().optional().default(""),
        company: z.string().optional().default(""),
        location: z.string().optional().default(""),
        description: z.string().optional().default(""),
      }),
    )
    .max(MAX_JOBS),
});

function jobText(j: { title: string; company: string; location: string; description: string }): string {
  const desc = (j.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500);
  return `${j.title} at ${j.company}. ${j.location}. ${desc}`;
}

function bandFor(pct: number): "strong" | "good" | "weak" {
  if (pct >= 75) return "strong";
  if (pct >= 60) return "good";
  return "weak";
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to match jobs." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { jobs } = parsed.data;
  if (!jobs.length) return NextResponse.json({ scores: {} });

  const ok = await ensureCvSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ error: "Matching unavailable." }, { status: 503 });

  // Need a CV to match against.
  let cvVec: string;
  try {
    const rows = await sql`SELECT embedding::text AS emb FROM user_cv WHERE user_id = ${userId}`;
    if (!rows[0]?.emb) {
      return NextResponse.json({ error: "Upload your CV first to match jobs." }, { status: 400 });
    }
    cvVec = rows[0].emb as string;
  } catch {
    return NextResponse.json({ error: "Couldn't read your CV." }, { status: 500 });
  }

  // Rate-limit the expensive path (embedding new jobs).
  const allowed = await allowAi(userId);
  if (!allowed) {
    return NextResponse.json({ error: "Match limit reached (5/hour). Try again later." }, { status: 429 });
  }

  // Job embeddings are cached in a table keyed by job id, so each job is only
  // ever embedded once — repeat matches (by anyone) cost zero embedding calls.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS job_embeddings (
        job_id     TEXT PRIMARY KEY,
        embedding  vector(768),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  } catch {
    /* table may already exist with a fixed dim */
  }

  const ids = jobs.map((j) => j.id);
  const cached = new Map<string, boolean>();
  try {
    const rows = await sql`SELECT job_id FROM job_embeddings WHERE job_id = ANY(${ids})`;
    for (const r of rows) cached.set(r.job_id as string, true);
  } catch {
    /* proceed; treat all as uncached */
  }

  // Embed and store any jobs we haven't seen before.
  for (const j of jobs) {
    if (cached.has(j.id)) continue;
    try {
      const vec = toVectorLiteral(await embed(jobText(j)));
      await sql`
        INSERT INTO job_embeddings (job_id, embedding) VALUES (${j.id}, ${vec}::vector)
        ON CONFLICT (job_id) DO NOTHING
      `;
    } catch {
      /* skip a job that fails to embed */
    }
  }

  // Score each job by cosine similarity to the CV vector. pgvector's <=> is
  // cosine distance (0 = identical), so similarity = 1 - distance.
  const scores: Record<string, { pct: number; band: string }> = {};
  try {
    const rows = await sql`
      SELECT job_id, 1 - (embedding <=> ${cvVec}::vector) AS sim
      FROM job_embeddings
      WHERE job_id = ANY(${ids})
    `;
    for (const r of rows) {
      const sim = Number(r.sim);
      const pct = Math.max(0, Math.min(100, Math.round(sim * 100)));
      scores[r.job_id as string] = { pct, band: bandFor(pct) };
    }
  } catch {
    return NextResponse.json({ error: "Scoring failed." }, { status: 500 });
  }

  return NextResponse.json({ scores });
}
