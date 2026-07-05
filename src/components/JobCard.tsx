"use client";

import { useState } from "react";
import type { Job } from "@/lib/types";
import { requestAgent, requestSkills } from "@/lib/ai";
import type { MatchScore } from "@/lib/match";

const FIT_LABEL: Record<string, string> = { strong: "Strong fit", good: "Good fit", weak: "Weak fit" };

// Minimal, safe markdown rendering: **bold** and "- " bullets only.
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

type SkillGap = { required: string[]; have: string[]; missing: string[] };

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
  // Check/Match (fast, free keyword skills gap)
  const [gapLoading, setGapLoading] = useState(false);
  const [gap, setGap] = useState<SkillGap | null>(null);
  const [gapError, setGapError] = useState("");

  // Draft application (LLM agent)
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentAnalysis, setAgentAnalysis] = useState("");
  const [agentLetter, setAgentLetter] = useState("");
  const [agentError, setAgentError] = useState("");
  const [copied, setCopied] = useState(false);

  async function runCheck() {
    if (!authed) {
      onLoginRequired();
      return;
    }
    setGap(null);
    setGapError("");
    setGapLoading(true);
    const res = await requestSkills(job);
    setGapLoading(false);
    if (res.ok) {
      setGap({ required: res.required ?? [], have: res.have ?? [], missing: res.missing ?? [] });
    } else {
      setGapError(res.error ?? "Could not compare skills. Try again.");
    }
  }

  async function runAgent() {
    if (!authed) {
      onLoginRequired();
      return;
    }
    setAgentAnalysis("");
    setAgentLetter("");
    setAgentError("");
    setCopied(false);
    setAgentLoading(true);
    const res = await requestAgent(job);
    setAgentLoading(false);
    if (res.ok) {
      setAgentAnalysis(res.analysis ?? "");
      setAgentLetter(res.coverLetter ?? "");
    } else {
      setAgentError(res.error ?? "Could not draft an application. Try again.");
    }
  }

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(agentLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="card">
      <div className="card-top">
        <div className="card-title">{job.title}</div>
        <div className="badges">
          {match && (
            <span className={`fit fit-${match.band}`} title="Semantic match to your CV">
              {FIT_LABEL[match.band] ?? "Fit"} · {match.pct}%
            </span>
          )}
          {job.isRemote && <span className="pill pill-remote">Remote</span>}
          <span className="pill pill-src">{job.sourceLabel}</span>
        </div>
      </div>
      <div className="card-company">{job.company || "\u2013"}</div>
      {job.location && <div className="card-loc">{job.location}</div>}

      <div className="card-actions">
        <button className="act-btn" onClick={runCheck} disabled={gapLoading}>
          {gapLoading ? "Checking\u2026" : "\u25ce Check match"}
        </button>
        <button className="act-btn agent-btn" onClick={runAgent} disabled={agentLoading}>
          &#9819; Draft application
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

      {(gapLoading || gap || gapError) && (
        <div className="ai-panel">
          <div className="ai-panel-head">Skills check <span className="ai-personal"> · vs your CV</span></div>
          {gapLoading && <div className="ai-loading">Comparing...</div>}
          {gapError && <div className="warn" style={{ margin: 0 }}>{gapError}</div>}
          {gap && (
            <div className="gap">
              {gap.required.length === 0 ? (
                <p style={{ margin: 0 }}>No specific tech skills detected in this posting.</p>
              ) : (
                <>
                  <div className="gap-row">
                    <span className="gap-label">You have</span>
                    <span className="gap-chips">
                      {gap.have.length ? (
                        gap.have.map((s) => <span key={s} className="gap-chip gap-have">{s}</span>)
                      ) : (
                        <span className="gap-none">none of the detected skills</span>
                      )}
                    </span>
                  </div>
                  <div className="gap-row">
                    <span className="gap-label">Missing</span>
                    <span className="gap-chips">
                      {gap.missing.length ? (
                        gap.missing.map((s) => <span key={s} className="gap-chip gap-miss">{s}</span>)
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

      {(agentLoading || agentAnalysis || agentLetter || agentError) && (
        <div className="ai-panel agent-panel">
          <div className="ai-panel-head">
            &#9819; Application assistant <span className="ai-personal"> · grounded in your CV</span>
          </div>
          {agentLoading && <div className="ai-loading">Analyzing the role, comparing your CV, drafting...</div>}
          {agentError && <div className="warn" style={{ margin: 0 }}>{agentError}</div>}
          {agentAnalysis && (
            <>
              <div className="agent-section-label">Fit analysis</div>
              <div className="ai-content">{renderMarkdown(agentAnalysis)}</div>
            </>
          )}
          {agentLetter && (
            <>
              <div className="agent-section-label">
                Draft cover letter
                <button className="copy-btn" onClick={copyLetter}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="ai-content">{renderMarkdown(agentLetter)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
