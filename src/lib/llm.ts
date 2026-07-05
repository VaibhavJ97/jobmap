// Provider-agnostic LLM layer. Today it calls Gemini; swapping providers means
// changing only this file. Returns plain text, or throws on failure.

const GEMINI_MODEL = "gemini-2.0-flash";

export async function generate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("LLM not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM status ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty LLM response");
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

// ---- Prompt builders -----------------------------------------------------

function jobContext(job: {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
}): string {
  const desc = (job.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 4000);
  return [
    `Title: ${job.title ?? ""}`,
    `Company: ${job.company ?? ""}`,
    `Location: ${job.location ?? ""}`,
    `Description: ${desc || "(no description provided)"}`,
  ].join("\n");
}

export function summaryPrompt(job: Parameters<typeof jobContext>[0]): string {
  return `You are helping a job seeker quickly understand a job posting. The posting may be in German or English.
Summarize it in clear English as short markdown with these sections, omitting any you can't determine:

**Role:** one sentence.
**Key skills:** comma-separated list.
**Seniority:** junior / mid / senior (best guess).
**Must-haves:** up to 4 short bullets.
**Work model:** remote / hybrid / on-site if stated.

Keep it under 120 words. Do not invent details not in the posting.

--- JOB POSTING ---
${jobContext(job)}`;
}

export function bulletsPrompt(job: Parameters<typeof jobContext>[0]): string {
  return `You are helping a job seeker apply to the role below. Write 4 concise, strong resume/cover-letter bullet points that a good candidate could use, each tailored to what this specific role values. Use general, honest phrasing (do not invent specific numbers or employers). Return only the 4 bullets as markdown "- " lines, under 90 words total.

--- JOB POSTING ---
${jobContext(job)}`;
}
