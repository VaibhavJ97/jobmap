import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const ok = await ensureSchema();
  const sql = getSql();
  if (!ok || !sql) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    const hash = await bcrypt.hash(parsed.data.password, 10);
    await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${hash})`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}
