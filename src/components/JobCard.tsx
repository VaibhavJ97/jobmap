"use client";

import { useState } from "react";
import type { Job } from "@/lib/types";
import { requestSkills, type SkillsResult } from "@/lib/ai";
import type { MatchScore } from "@/lib/match";

const FIT_LABEL: Record<string, string> = { strong: "Strong fit", good: "Good fit", weak: "Weak fit" };

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

          {result && !checkError && (
            <div className="gap">
              {result.note && <p className="cv-msg" style={{ marginTop: 0 }}>{result.note}</p>}

              <div className="gap-row">
                <span className="gap-label">You have</span>
                <span className="gap-chips">
                  {result.have?.length ? (
                    result.have.map((s) => <span key={s} className="gap-chip gap-have">{s}</span>)
                  ) : (
                    <span className="gap-none">no clear overlap with your CV</span>
                  )}
                </span>
              </div>

              <div className="gap-row">
                <span className="gap-label">Missing</span>
                <span className="gap-chips">
                  {result.missing?.length ? (
                    result.missing.map((s) => <span key={s} className="gap-chip gap-miss">{s}</span>)
                  ) : (
                    <span className="gap-none">nothing major, you cover the main requirements</span>
                  )}
                </span>
              </div>

              {result.fit && (
                <div className="gap-row">
                  <span className="gap-label">Fit</span>
                  <span className="gap-fit">{result.fit}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
