import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The owner id. In Phase 1b this is an anonymous per-browser id sent by the
// client. In Phase 1c it will be replaced by the authenticated session user id
// (same column, so no schema change needed).
function ownerId(request: Request): string | null {
  const id = request.headers.get("x-user-id");
  return id && id.length <= 100 ? id : null;
}

const SaveSchema = z.object({
  job: z.object({
    id: z.string(),
    title: z.string(),
    company: z.string().optional().default(""),
    location: z.string().optional().default(""),
    url: z.string().optional().default(""),
    source: z.string().optional().default(""),
    sourceLabel: z.string().optional().default(""),
    isRemote: z.boolean().optional().default(false),
    datePosted: z.string().nullable().optional().default(null),
    description: z.string().optional().default(""),
  }).passthrough(),
});

// GET /api/tracker  → list this owner's saved jobs
export async function GET(request: Request) {
  const owner = ownerId(request);
  if (!owner) return NextResponse.json({ saved: [] });
  const ok = await ensureSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ saved: [], warning: "database unavailable" });
  try {
    const rows = await sql`
      SELECT job_data FROM saved_jobs
      WHERE user_id = ${owner}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ saved: rows.map((r) => r.job_data) });
  } catch {
    return NextResponse.json({ saved: [], warning: "database error" });
  }
}

// POST /api/tracker  → save a job
export async function POST(request: Request) {
  const owner = ownerId(request);
  if (!owner) return NextResponse.json({ error: "missing user id" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid job" }, { status: 400 });

  const ok = await ensureSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const { job } = parsed.data;
  try {
    await sql`
      INSERT INTO saved_jobs (user_id, job_id, job_data)
      VALUES (${owner}, ${job.id}, ${JSON.stringify(job)})
      ON CONFLICT (user_id, job_id) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}

// DELETE /api/tracker?jobId=...  → remove a saved job
export async function DELETE(request: Request) {
  const owner = ownerId(request);
  if (!owner) return NextResponse.json({ error: "missing user id" }, { status: 400 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const ok = await ensureSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  try {
    await sql`DELETE FROM saved_jobs WHERE user_id = ${owner} AND job_id = ${jobId}`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
