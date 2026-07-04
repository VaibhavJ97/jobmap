"use client";

import type { Job } from "@/lib/types";
import JobCard from "./JobCard";

export default function JobList({
  jobs,
  onOpen,
  savedIds,
  onToggleSave,
}: {
  jobs: Job[];
  onOpen: (job: Job) => void;
  savedIds: Set<string>;
  onToggleSave: (job: Job) => void;
}) {
  if (jobs.length === 0)
    return <div className="empty">No jobs yet &mdash; try a search like &quot;backend developer&quot; or &quot;data analyst&quot;.</div>;
  return (
    <div className="list">
      {jobs.map((j) => (
        <JobCard
          key={`${j.source}-${j.id}`}
          job={j}
          onOpen={onOpen}
          saved={savedIds.has(j.id)}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
