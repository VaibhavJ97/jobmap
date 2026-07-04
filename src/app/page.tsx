"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import JobList from "@/components/JobList";
import MapView from "@/components/MapView";
import { fetchSaved, saveJob, removeJob } from "@/lib/tracker";
import type { Job, SearchResponse } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ total: number; duration: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);

  // Load this browser's saved jobs from the tracker on mount.
  useEffect(() => {
    fetchSaved().then((list) => {
      setSavedJobs(list);
      setSavedIds(new Set(list.map((j) => j.id)));
    });
  }, []);

  async function runSearch(keywords: string, location: string) {
    setLoading(true);
    setError("");
    setShowSaved(false);
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

  async function toggleSave(job: Job) {
    const isSaved = savedIds.has(job.id);
    // Optimistic UI update.
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(job.id);
      else next.add(job.id);
      return next;
    });
    setSavedJobs((prev) => (isSaved ? prev.filter((j) => j.id !== job.id) : [job, ...prev]));
    const ok = isSaved ? await removeJob(job.id) : await saveJob(job);
    if (!ok) {
      // Revert on failure and refetch the source of truth.
      const list = await fetchSaved();
      setSavedJobs(list);
      setSavedIds(new Set(list.map((j) => j.id)));
    }
  }

  const displayed = showSaved ? savedJobs : jobs;

  return (
    <main className="wrap">
      <div className="site-head">
        <h1 className="site-title">
          Job<span>Map</span>
        </h1>
        <a className="back-link" href="https://vaibhavj97.vercel.app/">
          &larr; Back to portfolio
        </a>
      </div>
      <p className="site-sub">European tech jobs from multiple sources, ranked by relevance and plotted on a map.</p>

      <SearchForm onSearch={runSearch} loading={loading} />

      <div className="view-tabs">
        <button className={`view-tab ${!showSaved ? "active" : ""}`} onClick={() => setShowSaved(false)}>
          Search results
        </button>
        <button className={`view-tab ${showSaved ? "active" : ""}`} onClick={() => setShowSaved(true)}>
          Saved{savedJobs.length ? ` (${savedJobs.length})` : ""}
        </button>
      </div>

      {error && <div className="warn">{error}</div>}
      {!showSaved && meta && (
        <p className="meta">
          {meta.total} job{meta.total !== 1 ? "s" : ""} in {meta.duration}s
        </p>
      )}
      {!showSaved &&
        warnings.map((w, i) => (
          <div className="warn" key={i}>
            {w}
          </div>
        ))}
      {showSaved && savedJobs.length === 0 && (
        <p className="meta">No saved jobs yet. Click &quot;Save&quot; on any job to keep it here.</p>
      )}

      <div className="split">
        <JobList jobs={displayed} onOpen={openJob} savedIds={savedIds} onToggleSave={toggleSave} />
        <MapView jobs={displayed} onOpen={openJob} />
      </div>
    </main>
  );
}
