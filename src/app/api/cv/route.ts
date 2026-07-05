import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSql, ensureCvSchema } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

// Extract plain text from an uploaded PDF or Word file.
async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    // Import the inner module directly to avoid pdf-parse's debug file read.
    // @ts-expect-error - inner path has no bundled type declarations
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = mod.default as (b: Buffer) => Promise<{ text: string }>;
    const data = await pdf(buf);
    return data.text ?? "";
  }
  if (name.endsWith(".docx") || file.type.includes("word") || file.type.includes("officedocument")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value ?? "";
  }
  // Fallback: treat as plain text.
  return buf.toString("utf8");
}

// GET — does the signed-in user have a CV, and a short preview.
export async function GET() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ hasCv: false });
  const ok = await ensureCvSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ hasCv: false, warning: "CV storage unavailable" });
  try {
    const rows = await sql`SELECT cv_text, created_at FROM user_cv WHERE user_id = ${uid}`;
    if (!rows[0]) return NextResponse.json({ hasCv: false });
    const text = rows[0].cv_text as string;
    return NextResponse.json({
      hasCv: true,
      preview: text.slice(0, 160),
      length: text.length,
      updatedAt: rows[0].created_at,
    });
  } catch {
    return NextResponse.json({ hasCv: false, warning: "CV storage error" });
  }
}

// POST — upload a CV as a file (multipart) or as pasted text (JSON { text }).
export async function POST(request: Request) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Sign in to upload a CV." }, { status: 401 });

  const ok = await ensureCvSchema();
  const sql = getSql();
  if (!ok || !sql) {
    return NextResponse.json(
      { error: "CV storage isn't ready. Ensure the pgvector extension is enabled." },
      { status: 503 },
    );
  }

  let text = "";
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
      if (file.size > 2_000_000) return NextResponse.json({ error: "File too large (max 2 MB)." }, { status: 400 });
      text = await extractText(file);
    } else {
      const body = await request.json().catch(() => ({}));
      text = String(body?.text ?? "");
    }
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that file. Try a different PDF/Word file, or paste your CV text instead." },
      { status: 422 },
    );
  }

  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 50) {
    return NextResponse.json(
      { error: "Couldn't extract enough text. If it's a scanned PDF, paste your CV text instead." },
      { status: 422 },
    );
  }
  text = text.slice(0, 8000);

  // Embed once and store (upsert). created_at is refreshed so personalized
  // caches keyed by it are naturally invalidated on re-upload.
  try {
    const vec = toVectorLiteral(await embed(text));
    await sql`
      INSERT INTO user_cv (user_id, cv_text, embedding, created_at)
      VALUES (${uid}, ${text}, ${vec}::vector, now())
      ON CONFLICT (user_id) DO UPDATE
        SET cv_text = EXCLUDED.cv_text, embedding = EXCLUDED.embedding, created_at = now()
    `;
    return NextResponse.json({ ok: true, length: text.length });
  } catch (e) {
    console.error("CV store failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't process the CV. Please try again." }, { status: 500 });
  }
}

// DELETE — remove the user's CV.
export async function DELETE() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  try {
    await sql`DELETE FROM user_cv WHERE user_id = ${uid}`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't delete." }, { status: 500 });
  }
}
