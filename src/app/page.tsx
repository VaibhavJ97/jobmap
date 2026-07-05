"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SearchForm from "@/components/SearchForm";
import JobList from "@/components/JobList";
import MapView from "@/components/MapView";
import CvUpload from "@/components/CvUpload";
import { fetchSaved, saveJob, removeJob } from "@/lib/tracker";
import { matchJobs, type MatchScore } from "@/lib/match";
import type { Job, SearchResponse } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ total: number; duration: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);

  const [matchScores, setMatchScores] = useState<Record<string, MatchScore>>({});
  const [matchActive, setMatchActive] = useState(false);
  const [matching, setMatching] = useState(false);

  const loadSaved = useCallback(() => {
    fetchSaved().then(({ saved }) => {
      setSavedJobs(saved);
      setSavedIds(new Set(saved.map((j) => j.id)));
    });
  }, []);

  useEffect(() => {
    if (authed) loadSaved();
    else {
      setSavedJobs([]);
      setSavedIds(new Set());
    }
  }, [authed, loadSaved]);

  async function runSearch(keywords: string, location: string) {
    setLoading(true);
    setError("");
    setShowSaved(false);
    setMatchScores({});
    setMatchActive(false);
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
    if (!authed) {
      router.push("/login");
      return;
    }
    const isSaved = savedIds.has(job.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(job.id);
      else next.add(job.id);
      return next;
    });
    setSavedJobs((prev) => (isSaved ? prev.filter((j) => j.id !== job.id) : [job, ...prev]));
    const ok = isSaved ? await removeJob(job.id) : await saveJob(job);
    if (!ok) loadSaved();
  }

  async function runMatch() {
    if (!authed) {
      router.push("/login");
      return;
    }
    setMatching(true);
    setError("");
    const res = await matchJobs(jobs);
    setMatching(false);
    if (res.ok && res.scores) {
      setMatchScores(res.scores);
      setMatchActive(true);
    } else {
      setError(res.error ?? "Could not match jobs.");
    }
  }

  const baseList = showSaved ? savedJobs : jobs;
  const displayed =
    matchActive && !showSaved
      ? [...baseList].sort((a, b) => (matchScores[b.id]?.pct ?? -1) - (matchScores[a.id]?.pct ?? -1))
      : baseList;

  return (
    <main className="wrap">
      <div className="site-head">
        <h1 className="site-title">
          Job<span>Map</span>
        </h1>
        <div className="head-right">
          {authed ? (
            <>
              <span className="head-email">{session?.user?.email}</span>
              <button className="link-btn" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
            </>
          ) : (
            <a className="link-btn" href="/login">Sign in</a>
          )}
          <a className="back-link" href="https://vaibhavj97.vercel.app/">&larr; Portfolio</a>
        </div>
      </div>
      <p className="site-sub">European tech jobs from multiple sources, ranked by relevance and plotted on a map.</p>

      <SearchForm onSearch={runSearch} loading={loading} />

      {authed && <CvUpload />}

      <div className="view-tabs">
        <button className={`view-tab ${!showSaved ? "active" : ""}`} onClick={() => setShowSaved(false)}>
          Search results
        </button>
        <button className={`view-tab ${showSaved ? "active" : ""}`} onClick={() => setShowSaved(true)}>
          Saved{savedJobs.length ? ` (${savedJobs.length})` : ""}
        </button>
        {authed && !showSaved && jobs.length > 0 && (
          <button className="match-btn" onClick={runMatch} disabled={matching}>
            {matching ? "Matching…" : matchActive ? "↻ Re-match my CV" : "◎ Match my CV"}
          </button>
        )}
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
      {showSaved && !authed && (
        <p className="meta">
          <a className="link-btn" href="/login">Sign in</a> to save and track jobs.
        </p>
      )}
      {showSaved && authed && savedJobs.length === 0 && (
        <p className="meta">No saved jobs yet. Click &quot;Save&quot; on any job to keep it here.</p>
      )}

      <div className="split">
        <JobList
          jobs={displayed}
          onOpen={openJob}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          authed={authed}
          onLoginRequired={() => router.push("/login")}
          matchScores={matchActive ? matchScores : undefined}
        />
        <MapView jobs={displayed} onOpen={openJob} />
      </div>
    </main>
  );
}
