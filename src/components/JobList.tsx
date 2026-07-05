"use client";

import type { Job } from "@/lib/types";
import JobCard from "./JobCard";
import type { MatchScore } from "@/lib/match";

export default function JobList({
  jobs,
  onOpen,
  savedIds,
  onToggleSave,
  authed,
  onLoginRequired,
  matchScores,
}: {
  jobs: Job[];
  onOpen: (job: Job) => void;
  savedIds: Set<string>;
  onToggleSave: (job: Job) => void;
  authed: boolean;
  onLoginRequired: () => void;
  matchScores?: Record<string, MatchScore>;
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
          authed={authed}
          onLoginRequired={onLoginRequired}
          match={matchScores?.[j.id]}
        />
      ))}
    </div>
  );
}
