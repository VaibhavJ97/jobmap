import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSql, ensureSchema, ensureCvSchema } from "@/lib/db";
import { allowAi } from "@/lib/rateLimit";
import { generate, agentAnalysisPrompt, agentCoverLetterPrompt } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  job: z
    .object({
      id: z.string(),
      title: z.string().optional().default(""),
      company: z.string().optional().default(""),
      location: z.string().optional().default(""),
      description: z.string().optional().default(""),
    })
    .passthrough(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { job } = parsed.data;

  await ensureSchema();
  const sql = getSql();

  // The agent is CV-grounded, so a CV is required.
  let cvText = "";
  let stamp = 0;
  if (sql) {
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
  }
  if (!cvText) {
    return NextResponse.json({ error: "Upload your CV first to draft an application." }, { status: 400 });
  }

  const cacheKey = `agent:${userId}:${stamp}:${job.id}`;

  // Cache first — a full draft is expensive, so repeats cost zero quota.
  if (sql) {
    try {
      const rows = await sql`SELECT content FROM ai_cache WHERE cache_key = ${cacheKey}`;
      if (rows[0]?.content) {
        return NextResponse.json({ ...JSON.parse(rows[0].content as string), cached: true });
      }
    } catch {
      /* fall through to generate */
    }
  }

  const allowed = await allowAi(userId);
  if (!allowed) {
    return NextResponse.json({ error: "AI limit reached (5/hour). Please try again later." }, { status: 429 });
  }

  try {
    // Step 1: analyze fit (requirements / strengths / gaps).
    const analysis = await generate(agentAnalysisPrompt(job, cvText));
    // Step 2: write the letter, grounded in step 1's analysis.
    const coverLetter = await generate(agentCoverLetterPrompt(job, cvText, analysis));

    const result = { analysis, coverLetter };
    if (sql) {
      try {
        await sql`
          INSERT INTO ai_cache (cache_key, content) VALUES (${cacheKey}, ${JSON.stringify(result)})
          ON CONFLICT (cache_key) DO NOTHING
        `;
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({ ...result, cached: false });
  } catch (e) {
    console.error("Agent failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The assistant is busy. Please try again shortly." }, { status: 502 });
  }
}
