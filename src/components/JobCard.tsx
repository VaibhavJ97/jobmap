"use client";

import type { Job } from "@/lib/types";

const MATCH_LABEL: Record<string, string> = { strong: "Strong", good: "Good", weak: "Weak" };

export default function JobCard({ job, onOpen }: { job: Job; onOpen: (job: Job) => void }) {
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
    </div>
  );
}
