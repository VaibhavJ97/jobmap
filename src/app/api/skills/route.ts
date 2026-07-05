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

type Analysis = { have: string[]; missing: string[]; fit: string; mode: "ai" | "keyword"; note?: string };

// Keyword fallback, shaped identically to the AI result so the UI is uniform.
function keywordAnalysis(title: string, description: string, cvText: string, note?: string): Analysis {
  const jobText = `${title} ${(description || "").replace(/<[^>]+>/g, " ")}`;
  const gap = skillGap(jobText, cvText);
  return { have: gap.have, missing: gap.missing, fit: "", mode: "keyword", note };
}

// Pull a JSON object out of a model response, tolerating stray text/fences.
function parseJson(raw: string): { have: string[]; missing: string[]; fit: string } | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    return {
      have: Array.isArray(obj.have) ? obj.have.map(String) : [],
      missing: Array.isArray(obj.missing) ? obj.missing.map(String) : [],
      fit: typeof obj.fit === "string" ? obj.fit : "",
    };
  } catch {
    return null;
  }
}

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

  const description = await resolveDescription(job.source ?? "", job.url ?? "", job.description ?? "", job.refId ?? "");
  const title = job.title ?? "";
  const cacheKey = `match:${userId}:${stamp}:${job.id}`;

  // Cache first - repeats cost zero quota. Stored as the JSON analysis.
  try {
    const rows = await sql`SELECT content FROM ai_cache WHERE cache_key = ${cacheKey}`;
    if (rows[0]?.content) {
      const cached = parseJson(rows[0].content as string);
      if (cached) return NextResponse.json({ ...cached, mode: "ai", cached: true });
    }
  } catch {
    /* fall through */
  }

  // AI path is rate-limited; out of quota -> instant keyword check (same shape).
  const allowed = await allowAi(userId);
  if (!allowed) {
    return NextResponse.json(
      keywordAnalysis(title, description, cvText, "AI limit reached (5/hour); showing a quick keyword check."),
    );
  }

  try {
    const raw = await generate(matchAnalysisPrompt({ ...job, description }, cvText));
    const obj = parseJson(raw);
    if (!obj) {
      return NextResponse.json(keywordAnalysis(title, description, cvText));
    }
    try {
      await sql`
        INSERT INTO ai_cache (cache_key, content) VALUES (${cacheKey}, ${JSON.stringify(obj)})
        ON CONFLICT (cache_key) DO NOTHING
      `;
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ ...obj, mode: "ai", cached: false });
  } catch {
    return NextResponse.json(keywordAnalysis(title, description, cvText));
  }
}
