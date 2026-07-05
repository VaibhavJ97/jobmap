export type WorkModel = "remote" | "hybrid" | "onsite";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  sourceLabel: string;
  isRemote: boolean;
  datePosted: string | null;
  description: string;
  alsoOn: string[];
  // Attached during processing:
  relevance?: number;
  match?: "strong" | "good" | "weak";
  lat?: number;
  lng?: number;
  city?: string;
  region?: "DE" | "DACH" | "EU" | "OTHER";
  lang?: "de" | "en";
}

export interface SearchPrefs {
  workModels: WorkModel[];
  countries: string[];
}

export interface SearchResponse {
  results: Job[];
  total: number;
  durationSeconds: number;
  warnings: string[];
}
