import type { Job } from "../types";

// Minimal Job factory for tests; override only what a test cares about.
export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: "Software Engineer",
    company: "Acme GmbH",
    location: "Berlin, Germany",
    url: "https://example.com/job",
    source: "ARBEITNOW",
    sourceLabel: "Arbeitnow",
    isRemote: false,
    datePosted: null,
    description: "",
    alsoOn: [],
    ...overrides,
  };
}
