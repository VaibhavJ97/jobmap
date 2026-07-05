import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSql, ensureSchema } from "@/lib/db";
import { allowAi } from "@/lib/rateLimit";
import { generate, summaryPrompt, bulletsPrompt } from "@/lib/llm";

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
  // 1) Must be signed in.
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { kind, job } = parsed.data;

  await ensureSchema();
  const sql = getSql();
  const cacheKey = `${kind}:${job.id}`;

  // 2) Cache first — a summary of a fixed posting never changes, so this
  //    returns instantly with zero AI usage for any repeat request.
  if (sql) {
    try {
      const rows = await sql`SELECT content FROM ai_cache WHERE cache_key = ${cacheKey}`;
      if (rows[0]?.content) {
        return NextResponse.json({ content: rows[0].content as string, cached: true });
      }
    } catch {
      /* fall through to generate */
    }
  }

  // 3) Only cache misses cost quota — rate-limit those per user.
  const allowed = await allowAi(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: "AI limit reached (5/hour). Please try again later." },
      { status: 429 },
    );
  }

  // 4) Generate, then store for everyone next time.
  try {
    const prompt = kind === "summary" ? summaryPrompt(job) : bulletsPrompt(job);
    const content = await generate(prompt);
    if (sql) {
      try {
        await sql`
          INSERT INTO ai_cache (cache_key, content) VALUES (${cacheKey}, ${content})
          ON CONFLICT (cache_key) DO NOTHING
        `;
      } catch {
        /* caching is best-effort */
      }
    }
    return NextResponse.json({ content, cached: false });
  } catch {
    return NextResponse.json({ error: "The AI service is busy. Please try again shortly." }, { status: 502 });
  }
}
