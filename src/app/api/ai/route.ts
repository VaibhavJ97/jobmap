import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSql, ensureSchema, ensureCvSchema } from "@/lib/db";
import { allowAi } from "@/lib/rateLimit";
import { generate, summaryPrompt, bulletsPrompt, personalBulletsPrompt } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  kind: z.enum(["summary", "bullets"]),
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
  if (!userId) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { kind, job } = parsed.data;

  await ensureSchema();
  const sql = getSql();

  // For personalized bullets, load the user's CV (if any). This changes both
  // the prompt and the cache key (so each user's CV yields its own cached copy,
  // invalidated when they re-upload - the key includes the CV timestamp).
  let cvText = "";
  let cacheKey = `${kind}:${job.id}`;
  let personalized = false;
  if (kind === "bullets" && sql) {
    try {
      await ensureCvSchema();
      const rows = await sql`SELECT cv_text, created_at FROM user_cv WHERE user_id = ${userId}`;
      if (rows[0]?.cv_text) {
        cvText = rows[0].cv_text as string;
        personalized = true;
        const stamp = new Date(rows[0].created_at as string).getTime();
        cacheKey = `bullets:${userId}:${stamp}:${job.id}`;
      }
    } catch {
      /* no CV - fall back to generic bullets */
    }
  }

  // Cache first - zero AI usage on repeats.
  if (sql) {
    try {
      const rows = await sql`SELECT content FROM ai_cache WHERE cache_key = ${cacheKey}`;
      if (rows[0]?.content) {
        return NextResponse.json({ content: rows[0].content as string, cached: true, personalized });
      }
    } catch {
      /* fall through to generate */
    }
  }

  // Only cache misses cost quota - rate-limit those per user.
  const allowed = await allowAi(userId);
  if (!allowed) {
    return NextResponse.json({ error: "AI limit reached (5/hour). Please try again later." }, { status: 429 });
  }

  try {
    const prompt =
      kind === "summary"
        ? summaryPrompt(job)
        : personalized
          ? personalBulletsPrompt(job, cvText)
          : bulletsPrompt(job);
    const content = await generate(prompt);
    if (sql) {
      try {
        await sql`
          INSERT INTO ai_cache (cache_key, content) VALUES (${cacheKey}, ${content})
          ON CONFLICT (cache_key) DO NOTHING
        `;
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({ content, cached: false, personalized });
  } catch (e) {
    console.error("AI generate failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The AI service is busy. Please try again shortly." }, { status: 502 });
  }
}
