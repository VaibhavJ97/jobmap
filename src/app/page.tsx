"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import JobList from "@/components/JobList";
import MapView from "@/components/MapView";
import type { Job, SearchResponse } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ total: number; duration: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function runSearch(keywords: string, location: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, location }),
      });
      const data = (await res.json()) as SearchResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setJobs(data.results);
      setMeta({ total: data.total, duration: data.durationSeconds });
      setWarnings(data.warnings ?? []);
      // Hand results to the detail page via sessionStorage.
      const map: Record<string, Job> = {};
      for (const j of data.results) map[j.id] = j;
      sessionStorage.setItem("jobmap:jobs", JSON.stringify(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setJobs([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  function openJob(job: Job) {
    router.push(`/jobs/${job.id}`);
  }

  return (
    <main className="wrap">
      <div className="site-head">
        <h1 className="site-title">
          Job<span>Map</span>
        </h1>
        <a className="back-link" href="https://vaibhavj97.vercel.app/">
          ← Back to portfolio
        </a>
      </div>
      <p className="site-sub">European tech jobs from multiple sources, ranked by relevance and plotted on a map.</p>

      <SearchForm onSearch={runSearch} loading={loading} />

      {error && <div className="warn">{error}</div>}
      {meta && (
        <p className="meta">
          {meta.total} job{meta.total !== 1 ? "s" : ""} in {meta.duration}s
        </p>
      )}
      {warnings.map((w, i) => (
        <div className="warn" key={i}>
          {w}
        </div>
      ))}

      <div className="split">
        <JobList jobs={jobs} onOpen={openJob} />
        <MapView jobs={jobs} onOpen={openJob} />
      </div>
    </main>
  );
}
