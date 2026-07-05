import { describe, it, expect } from "vitest";
import { deduplicate } from "../dedupe";
import { makeJob } from "./helpers";

describe("deduplicate", () => {
  it("keeps distinct jobs separate", () => {
    const jobs = [
      makeJob({ title: "Frontend Developer", company: "Acme GmbH" }),
      makeJob({ title: "Backend Developer", company: "Acme GmbH" }),
    ];
    expect(deduplicate(jobs)).toHaveLength(2);
  });

  it("merges the same job from two sources into one", () => {
    const jobs = [
      makeJob({ title: "Data Engineer", company: "Globex AG", source: "ARBEITNOW", sourceLabel: "Arbeitnow" }),
      makeJob({ title: "Data Engineer", company: "Globex AG", source: "REMOTIVE", sourceLabel: "Remotive" }),
    ];
    const out = deduplicate(jobs);
    expect(out).toHaveLength(1);
    // The surviving job should record that it also appeared on the other source.
    expect(out[0].alsoOn.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores legal suffixes when comparing companies", () => {
    const jobs = [
      makeJob({ title: "QA Analyst", company: "Initech GmbH" }),
      makeJob({ title: "QA Analyst", company: "Initech" }),
    ];
    expect(deduplicate(jobs)).toHaveLength(1);
  });

  it("keeps same title+company in different cities as distinct jobs", () => {
    const jobs = [
      makeJob({ title: "Programmierer", company: "RSB GmbH", location: "Essen, NRW" }),
      makeJob({ title: "Programmierer", company: "RSB GmbH", location: "Munich, Bayern" }),
    ];
    expect(deduplicate(jobs)).toHaveLength(2);
  });

  it("prefers the higher-priority source when merging", () => {
    const jobs = [
      makeJob({ title: "SRE", company: "Umbrella", source: "REMOTIVE", sourceLabel: "Remotive" }),
      makeJob({ title: "SRE", company: "Umbrella", source: "ARBEITSAGENTUR", sourceLabel: "Arbeitsagentur" }),
    ];
    const out = deduplicate(jobs);
    expect(out).toHaveLength(1);
    // Arbeitsagentur has priority 1 (beats Remotive), so it should win.
    expect(out[0].source).toBe("ARBEITSAGENTUR");
  });
});
