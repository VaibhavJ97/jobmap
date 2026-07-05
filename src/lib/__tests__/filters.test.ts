import { describe, it, expect } from "vitest";
import { applyFilters, type Filters } from "../../components/Filters";
import { makeJob } from "./helpers";

function baseFilters(overrides: Partial<Filters> = {}): Filters {
  return { lang: "all", region: "all", skills: new Set(), sources: new Set(), ...overrides };
}

describe("applyFilters", () => {
  const jobs = [
    makeJob({ id: "a", region: "DE", lang: "de", source: "ARBEITSAGENTUR", description: "React and TypeScript" }),
    makeJob({ id: "b", region: "DACH", lang: "en", source: "ARBEITNOW", description: "Python data pipelines" }),
    makeJob({ id: "c", region: "EU", lang: "en", source: "REMOTIVE", description: "QGIS and PostGIS mapping" }),
    makeJob({ id: "d", region: "OTHER", lang: "en", source: "REMOTEOK", description: "Anywhere remote role" }),
  ];

  it("returns everything with no filters", () => {
    expect(applyFilters(jobs, baseFilters())).toHaveLength(4);
  });

  it("filters by language", () => {
    expect(applyFilters(jobs, baseFilters({ lang: "de" })).map((j) => j.id)).toEqual(["a"]);
  });

  it("Germany region shows only DE", () => {
    expect(applyFilters(jobs, baseFilters({ region: "DE" })).map((j) => j.id)).toEqual(["a"]);
  });

  it("DACH region includes DE and DACH", () => {
    expect(applyFilters(jobs, baseFilters({ region: "DACH" })).map((j) => j.id).sort()).toEqual(["a", "b"]);
  });

  it("All Europe (EU) excludes only OTHER", () => {
    expect(applyFilters(jobs, baseFilters({ region: "EU" })).map((j) => j.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("filters by source", () => {
    expect(applyFilters(jobs, baseFilters({ sources: new Set(["REMOTIVE"]) })).map((j) => j.id)).toEqual(["c"]);
  });

  it("skills match ANY selected term (case-insensitive)", () => {
    const out = applyFilters(jobs, baseFilters({ skills: new Set(["qgis"]) }));
    expect(out.map((j) => j.id)).toEqual(["c"]);
  });

  it("composes multiple filters together", () => {
    const out = applyFilters(jobs, baseFilters({ lang: "en", region: "EU", skills: new Set(["python", "qgis"]) }));
    // English + European + (python OR qgis) -> jobs b and c
    expect(out.map((j) => j.id).sort()).toEqual(["b", "c"]);
  });
});
