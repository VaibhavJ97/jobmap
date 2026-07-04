import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, ensureSchema } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The owner id now comes from the authenticated session. Browsing and
// searching stay open; only the tracker requires a signed-in account.
async function ownerId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

const SaveSchema = z.object({
  job: z
    .object({
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
    })
    .passthrough(),
});

// GET /api/tracker  -> list the signed-in user's saved jobs
export async function GET() {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ saved: [], authenticated: false });
  const ok = await ensureSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ saved: [], authenticated: true, warning: "database unavailable" });
  try {
    const rows = await sql`
      SELECT job_data FROM saved_jobs
      WHERE user_id = ${owner}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ saved: rows.map((r) => r.job_data), authenticated: true });
  } catch {
    return NextResponse.json({ saved: [], authenticated: true, warning: "database error" });
  }
}

// POST /api/tracker  -> save a job (requires login)
export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "You must be signed in to save jobs." }, { status: 401 });
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

// DELETE /api/tracker?jobId=...  -> remove a saved job (requires login)
export async function DELETE(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
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
