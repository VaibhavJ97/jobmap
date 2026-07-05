"use client";

import { useState } from "react";
import type { Job } from "@/lib/types";
import { requestAi } from "@/lib/ai";
import type { MatchScore } from "@/lib/match";

const MATCH_LABEL: Record<string, string> = { strong: "Strong", good: "Good", weak: "Weak" };
const FIT_LABEL: Record<string, string> = { strong: "Strong fit", good: "Good fit", weak: "Weak fit" };

// Minimal, safe markdown rendering: escapes text, then applies **bold** and
// turns "- " lines into list items. No raw HTML from the model is injected.
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n").filter((l) => l.trim() !== "");
  return lines.map((line, i) => {
    const isBullet = /^\s*[-*]\s+/.test(line);
    const text = isBullet ? line.replace(/^\s*[-*]\s+/, "") : line;
    const parts = text.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>,
    );
    return isBullet ? (
      <li key={i}>{parts}</li>
    ) : (
      <p key={i} style={{ margin: "0.35rem 0" }}>{parts}</p>
    );
  });
}

export default function JobCard({
  job,
  onOpen,
  saved,
  onToggleSave,
  authed,
  onLoginRequired,
  match,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  saved: boolean;
  onToggleSave: (job: Job) => void;
  authed: boolean;
  onLoginRequired: () => void;
  match?: MatchScore;
}) {
  const [aiKind, setAiKind] = useState<"summary" | "bullets" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContent, setAiContent] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiPersonalized, setAiPersonalized] = useState(false);

  async function runAi(kind: "summary" | "bullets") {
    if (!authed) {
      onLoginRequired();
      return;
    }
    setAiKind(kind);
    setAiContent("");
    setAiError("");
    setAiPersonalized(false);
    setAiLoading(true);
    const res = await requestAi(job, kind);
    setAiLoading(false);
    if (res.ok && res.content) {
      setAiContent(res.content);
      setAiPersonalized(Boolean(res.personalized));
    } else setAiError(res.error ?? "Could not generate. Try again.");
  }

  return (
    <div className="card" onClick={() => onOpen(job)}>
      <div className="card-top">
        <div className="card-title">{job.title}</div>
        <div className="badges">
          {match && (
            <span className={`fit fit-${match.band}`} title="Semantic match to your CV">
              {FIT_LABEL[match.band] ?? "Fit"} · {match.pct}%
            </span>
          )}
          {typeof job.relevance === "number" && (
            <span className={`match match-${job.match}`} title={`Relevance ${job.relevance}/100`}>
              {MATCH_LABEL[job.match ?? "weak"]}
            </span>
          )}
          {job.isRemote && <span className="pill pill-remote">Remote</span>}
          <span className="pill pill-src">{job.sourceLabel}</span>
        </div>
      </div>
      <div className="card-company">{job.company || "\u2013"}</div>
      {job.location && <div className="card-loc">{job.location}</div>}

      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => onToggleSave(job)}>
          {saved ? "\u2713 Saved" : "+ Save"}
        </button>
        <button className="ai-btn" onClick={() => runAi("summary")} disabled={aiLoading}>
          &#10024; AI summary
        </button>
        <button className="ai-btn" onClick={() => runAi("bullets")} disabled={aiLoading}>
          &#10024; Tailored bullets
        </button>
      </div>

      {(aiLoading || aiContent || aiError) && (
        <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
          <div className="ai-panel-head">
            {aiKind === "bullets" ? "Tailored application bullets" : "AI summary"}
            {aiKind === "bullets" && aiPersonalized && <span className="ai-personal"> · from your CV</span>}
          </div>
          {aiLoading && <div className="ai-loading">Thinking…</div>}
          {aiError && <div className="warn" style={{ margin: 0 }}>{aiError}</div>}
          {aiContent && <div className="ai-content">{renderMarkdown(aiContent)}</div>}
        </div>
      )}
    </div>
  );
}
