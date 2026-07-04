import { NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export async function POST(request: Request) {
  const session = await auth();
  const to = session?.user?.email;
  if (!to) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const job = body?.job;
  if (!job?.title) return NextResponse.json({ error: "Invalid job." }, { status: 400 });

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Email is not configured." }, { status: 503 });

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#15201a">
      <h2 style="color:#2d6a4f;margin:0 0 4px">${esc(job.title)}</h2>
      <p style="margin:0 0 2px;font-weight:600">${esc(job.company || "")}</p>
      ${job.location ? `<p style="margin:0 0 12px;color:#6b7a72">${esc(job.location)}</p>` : ""}
      ${job.url ? `<p><a href="${esc(job.url)}" style="background:#2d6a4f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Apply on original site</a></p>` : ""}
      <p style="margin-top:20px;color:#9aa39c;font-size:12px">Saved from JobMap · vaibhavj97-jobmap.vercel.app</p>
    </div>`;

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject: `Job: ${job.title}`,
      html,
    });
    if (error) return NextResponse.json({ error: "Could not send the email." }, { status: 502 });
    return NextResponse.json({ ok: true, to });
  } catch {
    return NextResponse.json({ error: "Could not send the email." }, { status: 500 });
  }
}
