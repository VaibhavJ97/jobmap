"use client";

import { useState } from "react";
import type { Job } from "@/lib/types";
import { requestSkills, type SkillsResult } from "@/lib/ai";
import type { MatchScore } from "@/lib/match";

const FIT_LABEL: Record<string, string> = { strong: "Strong fit", good: "Good fit", weak: "Weak fit" };

// Minimal, safe markdown: **bold** and "- " bullets only.
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n").filter((l) => l.trim() !== "");
  return lines.map((line, i) => {
    const isBullet = /^\s*[-*]\s+/.test(line);
    const text = isBullet ? line.replace(/^\s*[-*]\s+/, "") : line;
    const parts = text.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>,
    );
    return isBullet ? <li key={i}>{parts}</li> : <p key={i} style={{ margin: "0.35rem 0" }}>{parts}</p>;
  });
}

export default function JobCard({
  job,
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
  const [checkLoading, setCheckLoading] = useState(false);
  const [result, setResult] = useState<SkillsResult | null>(null);
  const [checkError, setCheckError] = useState("");

  async function runCheck() {
    if (!authed) {
      onLoginRequired();
      return;
    }
    setResult(null);
    setCheckError("");
    setCheckLoading(true);
    const res = await requestSkills(job);
    setCheckLoading(false);
    if (res.ok) setResult(res);
    else setCheckError(res.error ?? "Could not compare. Try again.");
  }

  return (
    <div className="card">
      <div className="card-top">
        <div className="card-title">{job.title}</div>
        <div className="badges">
          {match && (
            <span className={`fit fit-${match.band}`} title="Semantic match to your CV">
              {FIT_LABEL[match.band] ?? "Fit"} &middot; {match.pct}%
            </span>
          )}
          {job.isRemote && <span className="pill pill-remote">Remote</span>}
          <span className="pill pill-src">{job.sourceLabel}</span>
        </div>
      </div>
      <div className="card-company">{job.company || "\u2013"}</div>
      {job.location && <div className="card-loc">{job.location}</div>}

      <div className="card-actions">
        <button className="act-btn" onClick={runCheck} disabled={checkLoading}>
          {checkLoading ? "Checking\u2026" : "\u25ce Check match"}
        </button>
        <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => onToggleSave(job)}>
          {saved ? "\u2713 Saved" : "+ Save"}
        </button>
        {job.url && (
          <a className="act-btn act-apply apply-right" href={job.url} target="_blank" rel="noopener noreferrer">
            Apply &#8599;
          </a>
        )}
      </div>

      {(checkLoading || result || checkError) && (
        <div className="ai-panel">
          <div className="ai-panel-head">
            Skills check <span className="ai-personal"> &middot; vs your CV</span>
          </div>
          {checkLoading && <div className="ai-loading">Analyzing against your CV...</div>}
          {checkError && <div className="warn" style={{ margin: 0 }}>{checkError}</div>}

          {result?.mode === "ai" && result.analysis && (
            <div className="ai-content">{renderMarkdown(result.analysis)}</div>
          )}

          {result?.mode === "keyword" && (
            <div className="gap">
              {result.note && <p className="cv-msg" style={{ marginTop: 0 }}>{result.note}</p>}
              {(result.required?.length ?? 0) === 0 ? (
                <p style={{ margin: 0 }}>No specific tech skills detected in this posting.</p>
              ) : (
                <>
                  <div className="gap-row">
                    <span className="gap-label">You have</span>
                    <span className="gap-chips">
                      {result.have?.length ? (
                        result.have.map((s) => <span key={s} className="gap-chip gap-have">{s}</span>)
                      ) : (
                        <span className="gap-none">none of the detected skills</span>
                      )}
                    </span>
                  </div>
                  <div className="gap-row">
                    <span className="gap-label">Missing</span>
                    <span className="gap-chips">
                      {result.missing?.length ? (
                        result.missing.map((s) => <span key={s} className="gap-chip gap-miss">{s}</span>)
                      ) : (
                        <span className="gap-none">nothing, you cover them all</span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
