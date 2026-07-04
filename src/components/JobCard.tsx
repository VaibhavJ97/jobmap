"use client";

import type { Job } from "@/lib/types";

const MATCH_LABEL: Record<string, string> = { strong: "Strong", good: "Good", weak: "Weak" };

export default function JobCard({
  job,
  onOpen,
  saved,
  onToggleSave,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  saved: boolean;
  onToggleSave: (job: Job) => void;
}) {
  return (
    <div className="card" onClick={() => onOpen(job)}>
      <div className="card-top">
        <div className="card-title">{job.title}</div>
        <div className="badges">
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
      <div className="card-actions">
        <button
          className={`save-btn ${saved ? "saved" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(job);
          }}
        >
          {saved ? "\u2713 Saved" : "+ Save"}
        </button>
      </div>
    </div>
  );
}
