"use client";

import { useState } from "react";
import type { Job } from "@/lib/types";
import { SKILL_GROUPS } from "@/lib/skills";

export type Filters = {
  lang: "all" | "en" | "de";
  region: "all" | "DE" | "DACH" | "EU";
  skills: Set<string>;
  sources: Set<string>;
};



function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function FilterPanel({
  jobs,
  filters,
  onChange,
  shownCount,
}: {
  jobs: Job[];
  filters: Filters;
  onChange: (f: Filters) => void;
  shownCount: number;
}) {
  // Master panel fold (expanded by default) and per-skill-category folds
  // (collapsed by default so the panel is compact; click a header to expand).
  const [open, setOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(SKILL_GROUPS.map((g) => g.label)),
  );
  function toggleGroupOpen(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const sourceCounts = new Map<string, { label: string; n: number }>();
  for (const j of jobs) {
    const cur = sourceCounts.get(j.source) ?? { label: j.sourceLabel, n: 0 };
    cur.n += 1;
    sourceCounts.set(j.source, cur);
  }
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1].n - a[1].n);

  const active =
    filters.lang !== "all" ||
    filters.region !== "all" ||
    filters.skills.size > 0 ||
    filters.sources.size > 0;

  // Is every skill in this group currently selected?
  function groupAllOn(groupSkills: string[]): boolean {
    return groupSkills.every((s) => filters.skills.has(s));
  }
  function toggleGroup(groupSkills: string[]) {
    const next = new Set(filters.skills);
    if (groupAllOn(groupSkills)) {
      for (const s of groupSkills) next.delete(s);
    } else {
      for (const s of groupSkills) next.add(s);
    }
    onChange({ ...filters, skills: next });
  }

  return (
    <div className="filters">
      <div className="filters-head">
        <button
          className="filters-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? "Collapse filters" : "Expand filters"}
        >
          <span className={`fold-arrow ${open ? "open" : ""}`}>&#9656;</span>
          <span className="filters-title">Filters</span>
        </button>
        <span className="filters-count">
          {shownCount} of {jobs.length} shown
        </span>
        {active && (
          <button
            className="filters-clear"
            onClick={() => onChange({ lang: "all", region: "all", skills: new Set(), sources: new Set() })}
          >
            Clear all
          </button>
        )}
      </div>

      {open && (
      <>
      <div className="filter-row">
        <span className="filter-label">Language</span>
        <div className="seg">
          {(["all", "en", "de"] as const).map((v) => (
            <button
              key={v}
              className={`seg-btn ${filters.lang === v ? "on" : ""}`}
              onClick={() => onChange({ ...filters, lang: v })}
            >
              {v === "all" ? "All" : v === "en" ? "English" : "German"}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">Region</span>
        <div className="seg">
          {(["all", "DE", "DACH", "EU"] as const).map((v) => (
            <button
              key={v}
              className={`seg-btn ${filters.region === v ? "on" : ""}`}
              onClick={() => onChange({ ...filters, region: v })}
            >
              {v === "all" ? "All" : v === "DE" ? "Germany" : v === "DACH" ? "DACH" : "All Europe"}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row filter-row-skills">
        <span className="filter-label">Skills</span>
        <div className="skill-groups">
          {SKILL_GROUPS.map((g) => {
            const expanded = openGroups.has(g.label);
            return (
              <div className="skill-group" key={g.label}>
                <div className="skill-group-bar">
                  <button
                    className="skill-group-fold"
                    onClick={() => toggleGroupOpen(g.label)}
                    aria-expanded={expanded}
                  >
                    <span className={`fold-arrow ${expanded ? "open" : ""}`}>&#9656;</span>
                    {g.label}
                  </button>
                  {expanded && (
                    <button
                      className={`skill-selectall ${groupAllOn(g.skills) ? "on" : ""}`}
                      onClick={() => toggleGroup(g.skills)}
                      title="Select or clear all in this group"
                    >
                      {groupAllOn(g.skills) ? "clear" : "all"}
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="chips">
                    {g.skills.map((s) => (
                      <button
                        key={s}
                        className={`chip ${filters.skills.has(s) ? "on" : ""}`}
                        onClick={() => onChange({ ...filters, skills: toggle(filters.skills, s) })}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">Sources</span>
          <div className="chips">
            {sources.map(([key, { label, n }]) => (
              <button
                key={key}
                className={`chip ${filters.sources.has(key) ? "on" : ""}`}
                onClick={() => onChange({ ...filters, sources: toggle(filters.sources, key) })}
              >
                {label} ({n})
              </button>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export function applyFilters(jobs: Job[], f: Filters): Job[] {
  return jobs.filter((j) => {
    if (f.lang !== "all" && j.lang !== f.lang) return false;
    if (f.region === "DE" && j.region !== "DE") return false;
    if (f.region === "DACH" && j.region !== "DE" && j.region !== "DACH") return false;
    if (f.region === "EU" && j.region === "OTHER") return false;
    if (f.sources.size > 0 && !f.sources.has(j.source)) return false;
    if (f.skills.size > 0) {
      const hay = `${j.title} ${j.description ?? ""}`.toLowerCase();
      let hit = false;
      for (const s of f.skills) {
        if (hay.includes(s)) {
          hit = true;
          break;
        }
      }
      if (!hit) return false;
    }
    return true;
  });
}
