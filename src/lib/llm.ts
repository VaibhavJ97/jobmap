// Provider-agnostic LLM layer. Today it calls Gemini; swapping providers means
// changing only this file. Returns plain text, or throws on failure.
//
// Model names on Gemini's free tier change over time and vary by key, so we try
// a list of known-good models in order and use the first that responds. The
// real upstream error is surfaced (not swallowed) to make debugging possible.

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

async function callModel(model: string, key: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? `status ${res.status}`;
      // 404 / NOT_FOUND means this model isn't available to the key - try the next one.
      const notFound = res.status === 404 || /not found|not supported/i.test(msg);
      throw Object.assign(new Error(`[${model}] ${msg}`), { retryable: notFound });
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`[${model}] empty response`);
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function generate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("LLM not configured: GEMINI_API_KEY missing");

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      return await callModel(model, key, prompt);
    } catch (e) {
      lastErr = e;
      // Only move to the next model if this one was "not found"; otherwise stop.
      if (!(e as { retryable?: boolean })?.retryable) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM failed");
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

export function personalBulletsPrompt(job: Parameters<typeof jobContext>[0], cvText: string): string {
  const cv = cvText.replace(/\s+/g, " ").slice(0, 4000);
  return `You are helping a specific job seeker apply to the role below, using THEIR CV. Write 4 concise, strong resume/cover-letter bullet points drawn from the candidate's real experience in the CV, each aimed at what this role values. Use only experience present in the CV - do not invent employers, numbers, or skills they don't have. If the CV lacks something the role wants, emphasize the closest genuine strength instead. Return only the 4 bullets as markdown "- " lines, under 100 words total.

--- JOB POSTING ---
${jobContext(job)}

--- CANDIDATE CV ---
${cv}`;
}

// ---- Agent: multi-step application assistant ------------------------------
// Step 1 analyzes the fit; step 2 consumes that analysis to write the letter.

// AI skills/fit analysis for the Check match button. Returns STRICT JSON so
// the UI can render Have / Missing / Fit consistently every time.
export function matchAnalysisPrompt(job: Parameters<typeof jobContext>[0], cvText: string): string {
  const cv = cvText.replace(/\s+/g, " ").slice(0, 4000);
  return `You are an honest job-fit assistant. Compare the candidate's CV to the job below.
Respond with ONLY a JSON object (no markdown, no code fences, no text before or after) in exactly this shape:
{
  "have": ["short phrase", ...],      // skills/qualifications the role wants that the CV genuinely shows (max 6; [] if none)
  "missing": ["short phrase", ...],   // skills/qualifications the role asks for that the CV does NOT clearly show (max 5; [] if none)
  "fit": "one or two plain sentences, realistic, no hype"
}
Infer skills from context (e.g. "built REST APIs" implies backend development), not just exact keywords. Do not invent CV content. Be honest about gaps.

--- JOB POSTING ---
${jobContext(job)}

--- CANDIDATE CV ---
${cv}`;
}

export function agentAnalysisPrompt(job: Parameters<typeof jobContext>[0], cvText: string): string {
  const cv = cvText.replace(/\s+/g, " ").slice(0, 4000);
  return `You are an honest application coach. Compare the candidate's CV to the job below and produce a short, truthful fit analysis in English markdown with exactly these three sections:

**Key requirements:** up to 5 short bullets of what this role actually needs.
**Your matching strengths:** up to 5 bullets, each citing something genuinely present in the CV.
**Gaps to address:** up to 4 bullets naming what the role wants that the CV does NOT clearly show. Be honest; do not pretend gaps away.

Do not invent CV content. Keep under 170 words total.

--- JOB POSTING ---
${jobContext(job)}

--- CANDIDATE CV ---
${cv}`;
}

export function agentCoverLetterPrompt(
  job: Parameters<typeof jobContext>[0],
  cvText: string,
  analysis: string,
): string {
  const cv = cvText.replace(/\s+/g, " ").slice(0, 3000);
  return `You are writing a tailored cover letter for the candidate applying to the role below. Use the FIT ANALYSIS to decide what to emphasize (lead with the matching strengths; do not dwell on gaps). Draw only on real experience from the CV - invent no employers, numbers, or skills. Write 3 short paragraphs, professional and warm, under 220 words. Return only the letter body as markdown (no placeholders like [Your Name]).

--- JOB POSTING ---
${jobContext(job)}

--- FIT ANALYSIS ---
${analysis}

--- CANDIDATE CV ---
${cv}`;
}
