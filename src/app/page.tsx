"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import SearchForm from "@/components/SearchForm";
import JobList from "@/components/JobList";
import MapView from "@/components/MapView";
import CvUpload from "@/components/CvUpload";
import AuthModal from "@/components/AuthModal";
import FilterPanel, { applyFilters, type Filters } from "@/components/Filters";
import { fetchSaved, saveJob, removeJob } from "@/lib/tracker";
import { matchJobs, type MatchScore } from "@/lib/match";
import type { Job, SearchResponse } from "@/lib/types";

export default function Home() {
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
  const [showAuth, setShowAuth] = useState(false);
  const [lastQuery, setLastQuery] = useState<{ keywords: string; location: string } | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreNote, setMoreNote] = useState("");

  const [matchScores, setMatchScores] = useState<Record<string, MatchScore>>({});
  const [matchActive, setMatchActive] = useState(false);
  const [matching, setMatching] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    lang: "all",
    region: "all",
    skills: new Set(),
    sources: new Set(),
  });

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
    setPage(0);
    setMoreNote("");
    setLastQuery({ keywords, location });
    setFilters({ lang: "all", region: "all", skills: new Set(), sources: new Set() });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, location, page: 0 }),
      });
      const data = (await res.json()) as SearchResponse & { error?: string; hasMore?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setJobs(data.results);
      setMeta({ total: data.total, duration: data.durationSeconds });
      setWarnings(data.warnings ?? []);
      setHasMore(Boolean(data.hasMore));
      const map: Record<string, Job> = {};
      for (const j of data.results) map[j.id] = j;
      // localStorage (not sessionStorage) so the detail page opened in a NEW
      // tab can read it; sessionStorage is isolated per tab.
      localStorage.setItem("jobmap:jobs", JSON.stringify(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setJobs([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!lastQuery || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lastQuery, page: nextPage }),
      });
      const data = (await res.json()) as SearchResponse & { error?: string; hasMore?: boolean };
      if (!res.ok) {
        // Ran out of pages or a transient issue: stop offering "load more"
        // rather than showing a raw validation message.
        setHasMore(false);
        return;
      }
      const rawCount = data.results.length;
      // Compute what is genuinely new against the current list up front, so the
      // caption below reflects reality. Doing this inside setJobs would read a
      // stale addedCount (the updater runs asynchronously).
      const seen = new Set(jobs.map((j) => j.id));
      const fresh = data.results.filter((j) => !seen.has(j.id));
      const addedCount = fresh.length;
      setJobs((prev) => {
        const prevSeen = new Set(prev.map((j) => j.id));
        const freshNow = data.results.filter((j) => !prevSeen.has(j.id));
        const merged = [...prev, ...freshNow];
        const map: Record<string, Job> = {};
        for (const j of merged) map[j.id] = j;
        localStorage.setItem("jobmap:jobs", JSON.stringify(map));
        // Keep the "X jobs" counter in sync with what is actually loaded.
        setMeta((m) => (m ? { ...m, total: merged.length } : m));
        return merged;
      });
      // Always advance the page so the next click digs deeper even if this
      // page was mostly duplicates. Keep the button while the source still
      // returns data (server's hasMore); only stop when it runs dry.
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
      setMoreNote(
        addedCount > 0
          ? `Added ${addedCount} more.`
          : rawCount > 0
            ? "Those were already in your list - click again for more."
            : "No more results from the deeper sources.",
      );
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  function openJob(job: Job) {
    // Open the real posting in a new tab, matching the card's Apply button.
    // Fall back to the internal page only if a job has no source URL.
    const target = job.url || `/jobs/${job.id}`;
    window.open(target, "_blank", "noopener,noreferrer");
  }

  async function toggleSave(job: Job) {
    if (!authed) {
      setShowAuth(true);
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
      setShowAuth(true);
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

  const baseList = showSaved ? savedJobs : applyFilters(jobs, filters);
  const displayed =
    matchActive && !showSaved
      ? [...baseList].sort((a, b) => (matchScores[b.id]?.pct ?? -1) - (matchScores[a.id]?.pct ?? -1))
      : baseList;

  return (
    <>
    <main className="wrap">
      <div className="intro">
        <div className="intro-top">
          <div className="sec-eyebrow">&sect; European tech job search</div>
          <div className="head-right">
            {authed ? (
              <>
                <span className="head-email">{session?.user?.email}</span>
                <button className="link-btn" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
              </>
            ) : (
              <button className="link-btn" onClick={() => setShowAuth(true)}>Sign in</button>
            )}
          </div>
        </div>
        <h2>
          Every European tech job, <em>on one map</em>.
        </h2>
        <span className="tech-tag">
          &rarr; Next.js &middot; TypeScript &middot; React &middot; Postgres &middot; pgvector &middot; Gemini &middot; RAG &middot; LLM &middot;{" "}
          <a href="https://github.com/VaibhavJ97/jobmap" target="_blank" rel="noopener noreferrer">source on GitHub</a>
        </span>
        <p>
          Search many free job sources at once, ranked by relevance and plotted across Europe.
          Filter by language, region, skills and source, then compare any role to your CV with a
          Gemini-powered skills check. One search, one filterable view, no tab-hopping between boards.
        </p>
      </div>

      <SearchForm onSearch={runSearch} loading={loading} />

      {authed && <CvUpload />}

      <div className="view-tabs">
        <button className={`view-tab ${!showSaved ? "active" : ""}`} onClick={() => setShowSaved(false)}>
          Search results
        </button>
        <button className={`view-tab ${showSaved ? "active" : ""}`} onClick={() => setShowSaved(true)}>
          Saved{savedJobs.length ? ` (${savedJobs.length})` : ""}
        </button>
        {!showSaved && jobs.length > 0 && (
          <button className="match-btn" onClick={runMatch} disabled={matching}>
            {matching ? "Matching..." : matchActive ? "\u21bb Re-match my CV" : "\u25ce Match my CV"}
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
          <button className="link-btn" onClick={() => setShowAuth(true)}>Sign in</button> to save and check match with CV.
        </p>
      )}
      {showSaved && authed && savedJobs.length === 0 && (
        <p className="meta">No saved jobs yet. Click &quot;Save&quot; on any job to keep it here.</p>
      )}

      {!showSaved && jobs.length > 0 && (
        <FilterPanel jobs={jobs} filters={filters} onChange={setFilters} shownCount={displayed.length} />
      )}

      <div className="split">
        <div className="list-col">
          <JobList
            jobs={displayed}
            onOpen={openJob}
            savedIds={savedIds}
            onToggleSave={toggleSave}
            authed={authed}
            onLoginRequired={() => setShowAuth(true)}
            matchScores={matchActive ? matchScores : undefined}
          />
          {!showSaved && jobs.length > 0 && hasMore && (
            <div className="load-more-row">
              <button className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading more..." : "Load more results"}
              </button>
            </div>
          )}
          {!showSaved && moreNote && <p className="more-note">{moreNote}</p>}
        </div>
        <MapView jobs={displayed} onOpen={openJob} />
      </div>

      {showAuth && !authed && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>

    <div className="explainer-wrap">
      <section className="explainer-section">
        <div className="sec-eyebrow">&sect; About this project</div>
        <h2>
          What is <em>JobMap</em>?
        </h2>
        <p className="lead">
          JobMap searches European tech jobs across many free sources at once - public APIs like
          Arbeitsagentur, Arbeitnow, Remotive, Jobicy, Remote OK and We Work Remotely, plus company
          career boards on Greenhouse, Lever and Ashby - then deduplicates them by title, company and
          location, ranks them by relevance, and plots them on an interactive map. Instead of opening
          a dozen job boards in separate tabs, you get one search and one filterable view.
        </p>
      </section>

      <section className="explainer-section">
        <div className="sec-eyebrow">&sect; How it works</div>
        <h2>
          From one search to the <em>right shortlist</em>.
        </h2>
        <p className="lead">Four steps from a keyword to an application, all in a single view.</p>
        <div className="how-grid">
          <div className="how-step">
            <div className="step-num">&rarr; 01 / SEARCH</div>
            <h4>Search once</h4>
            <p>Type a role and location. JobMap queries many job sources in parallel in a single request, so results arrive together.</p>
          </div>
          <div className="how-step">
            <div className="step-num">&rarr; 02 / FILTER</div>
            <h4>Filter live</h4>
            <p>Narrow by language, region, skills and source. The counts update as you compose filters, so you always see what matches.</p>
          </div>
          <div className="how-step">
            <div className="step-num">&rarr; 03 / CHECK MATCH</div>
            <h4>Check the fit</h4>
            <p>Upload your CV once. Any job can be compared to it for a skills match, powered by Google Gemini with a keyword fallback.</p>
          </div>
          <div className="how-step">
            <div className="step-num">&rarr; 04 / APPLY</div>
            <h4>Apply or save</h4>
            <p>Open the original posting in one click, or save it to your shortlist to revisit after signing in.</p>
          </div>
        </div>
      </section>

      <section className="explainer-section">
        <div className="sec-eyebrow">&sect; Tech stack</div>
        <h2>
          Built on <em>free, modern</em> tools.
        </h2>
        <p className="lead">Parallel API fan-out + serverless compute + AI matching, all running on free tiers.</p>
        <div className="tech-grid">
          <div className="tech-block">
            <span className="label">Sources</span>
            <p>Free, keyless job APIs (Arbeitsagentur, Arbeitnow, Remotive, Jobicy, Remote OK, We Work Remotely, The Muse) plus public ATS boards on Greenhouse, Lever, Ashby, Workable, Recruitee and SmartRecruiters.</p>
          </div>
          <div className="tech-block">
            <span className="label">Frontend</span>
            <p>Next.js App Router with TypeScript and React. Leaflet map with CARTO tiles and marker clustering, plus a live filterable results list.</p>
          </div>
          <div className="tech-block">
            <span className="label">Backend &amp; AI</span>
            <p>Node.js route handlers on Vercel. Neon Postgres with pgvector for CV embeddings, Google Gemini for the skills check, Upstash Redis for rate limiting.</p>
          </div>
          <div className="tech-block">
            <span className="label">Auth &amp; storage</span>
            <p>Auth.js email sign-in. Saved jobs and CV embeddings are stored per account in Postgres, so your shortlist follows you back.</p>
          </div>
          <div className="tech-block">
            <span className="label">Hosting</span>
            <p>Vercel free tier with GitHub auto-deploy. Total infrastructure cost: &euro;0 / month.</p>
          </div>
          <div className="tech-block">
            <span className="label">Development</span>
            <p>AI-pair-programming with <strong>Anthropic Claude</strong>, ChatGPT, and GitHub Copilot. Architecture, decisions and review by me.</p>
          </div>
        </div>
      </section>

      <section className="explainer-section">
        <div className="sec-eyebrow">&sect; How this was built</div>
        <h2>
          Built with <em>AI as a pair-programmer</em>.
        </h2>
        <p className="lead">
          <strong>Anthropic Claude</strong> was my primary pair-programmer for the multi-source fan-out,
          the relevance ranking, the location-aware dedupe, the pgvector CV matching, and the Leaflet
          map. <strong>ChatGPT</strong> helped iterate on which job sources were actually free and safe
          to call from a server. <strong>GitHub Copilot</strong> handled inline suggestions. I designed
          the product (one map, honest sources, on-demand AI), chose the architecture, decided what to
          leave out (no scraping of Indeed or LinkedIn), reviewed every line, and own the deployed
          system. AI accelerated the writing; the decisions stayed mine.
        </p>
      </section>
    </div>
    </>
  );
}
