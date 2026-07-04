"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Job } from "@/lib/types";

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("jobmap:jobs");
      if (raw) {
        const map = JSON.parse(raw) as Record<string, Job>;
        setJob(map[params.id] ?? null);
      }
    } catch {
      setJob(null);
    }
    setReady(true);
  }, [params.id]);

  return (
    <main className="wrap detail">
      <a className="back-link" href="/">
        ← Back to search
      </a>
      {!ready ? null : !job ? (
        <p className="empty">This job isn&apos;t in your current results. Run a search again from the home page.</p>
      ) : (
        <>
          <h1>{job.title}</h1>
          <div className="card-company">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </div>
          <div className="badges" style={{ marginTop: "0.5rem" }}>
            {job.isRemote && <span className="pill pill-remote">Remote</span>}
            <span className="pill pill-src">{job.sourceLabel}</span>
            {typeof job.relevance === "number" && <span className={`match match-${job.match}`}>{job.relevance}/100 match</span>}
          </div>
          {job.url && (
            <p style={{ marginTop: "1.25rem" }}>
              <a className="btn" href={job.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
                Apply on original site →
              </a>
            </p>
          )}
          {job.description && <div className="desc" dangerouslySetInnerHTML={{ __html: job.description }} />}
        </>
      )}
    </main>
  );
}
