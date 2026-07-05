import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSql, ensureCvSchema } from "@/lib/db";
import { skillGap } from "@/lib/skills";
import { resolveDescription } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  job: z
    .object({
      title: z.string().optional().default(""),
      description: z.string().optional().default(""),
      source: z.string().optional().default(""),
      url: z.string().optional().default(""),
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

  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Comparison unavailable." }, { status: 503 });

  let cvText = "";
  try {
    await ensureCvSchema();
    const rows = await sql`SELECT cv_text FROM user_cv WHERE user_id = ${userId}`;
    if (rows[0]?.cv_text) cvText = rows[0].cv_text as string;
  } catch {
    /* handled below */
  }
  if (!cvText) {
    return NextResponse.json({ error: "Upload your CV first to compare skills." }, { status: 400 });
  }

  // Pull the real description on demand (Arbeitsagentur ships empty at search).
  const description = await resolveDescription(job.source ?? "", job.url ?? "", job.description ?? "");

  // Pure keyword comparison, no AI: what the role names, what your CV shows.
  const jobText = `${job.title ?? ""} ${description.replace(/<[^>]+>/g, " ")}`;
  const gap = skillGap(jobText, cvText);
  return NextResponse.json(gap);
}
