import { describe, it, expect } from "vitest";
import { skillGap, hasSkill } from "../skills";

describe("hasSkill", () => {
  it("matches multi-word terms", () => {
    expect(hasSkill("experience with Google Earth Engine required", "google earth engine")).toBe(true);
  });

  it("does not match short terms inside other words", () => {
    // "r" should not match inside "developer"
    expect(hasSkill("senior developer role", "r")).toBe(false);
  });

  it("matches c++ correctly", () => {
    expect(hasSkill("strong C++ skills", "c++")).toBe(true);
  });
});

describe("skillGap", () => {
  it("splits required skills into have and missing", () => {
    const job = "We need Python, SQL and Docker experience";
    const cv = "I know Python and SQL well";
    const gap = skillGap(job, cv);
    expect(gap.required.sort()).toEqual(["docker", "python", "sql"]);
    expect(gap.have.sort()).toEqual(["python", "sql"]);
    expect(gap.missing).toEqual(["docker"]);
  });

  it("returns empty required when no known skills appear", () => {
    const gap = skillGap("A friendly team player wanted", "Python developer");
    expect(gap.required).toEqual([]);
    expect(gap.missing).toEqual([]);
  });
});
