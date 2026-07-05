"use client";

import type { Job } from "@/lib/types";

export type Filters = {
  lang: "all" | "en" | "de";
  region: "all" | "DE" | "DACH" | "EU";
  skills: Set<string>;
  sources: Set<string>;
};

// Skills grouped by field. Matching is case-insensitive substring on
// title + description, so multi-word terms like "google earth engine" work.
export const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  {
    label: "GIS / Geospatial",
    skills: [
      "gis",
      "qgis",
      "arcgis",
      "google earth engine",
      "postgis",
      "geospatial",
      "remote sensing",
      "gdal",
      "geopandas",
      "leaflet",
      "mapbox",
      "cartography",
      "lidar",
    ],
  },
  {
    label: "Software Development",
    skills: [
      "javascript",
      "typescript",
      "python",
      "java",
      "c++",
      "go",
      "rust",
      "react",
      "node",
      "html",
      "css",
      "php",
      "docker",
      "kubernetes",
      "git",
    ],
  },
  {
    label: "Data Analysis",
    skills: [
      "sql",
      "excel",
      "power bi",
      "tableau",
      "pandas",
      "numpy",
      "r",
      "statistics",
      "matplotlib",
      "looker",
      "jupyter",
    ],
  },
  {
    label: "Data Engineering",
    skills: [
      "spark",
      "hadoop",
      "airflow",
      "kafka",
      "etl",
      "snowflake",
      "databricks",
      "bigquery",
      "aws",
      "azure",
      "gcp",
      "dbt",
      "postgres",
    ],
  },
];

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
        <span className="filters-title">Filters</span>
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
          {SKILL_GROUPS.map((g) => (
            <div className="skill-group" key={g.label}>
              <button
                className={`skill-group-head ${groupAllOn(g.skills) ? "on" : ""}`}
                onClick={() => toggleGroup(g.skills)}
                title="Select or clear all in this group"
              >
                {g.label}
              </button>
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
            </div>
          ))}
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
