// Shared skill vocabulary. Used both by the filter panel and the Check/Match
// skills-gap comparison, so there is one source of truth for the term list.
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

// Flat list of every known skill term.
export const SKILL_TERMS: string[] = SKILL_GROUPS.flatMap((g) => g.skills);

// Whole-word-ish presence test. For short/ambiguous terms (r, go, c++) we
// require word boundaries so "r" doesn't match inside "developer".
export function hasSkill(text: string, skill: string): boolean {
  const hay = ` ${text.toLowerCase()} `;
  const s = skill.toLowerCase();
  if (s.length <= 2 || s === "c++" || s === "go") {
    // escape regex specials, then require boundaries
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+])${esc}([^a-z0-9+]|$)`, "i").test(` ${text} `);
  }
  return hay.includes(s);
}

// Compare a job's text against a CV's text and return the skill breakdown.
export function skillGap(jobText: string, cvText: string) {
  const required = SKILL_TERMS.filter((s) => hasSkill(jobText, s));
  const have = required.filter((s) => hasSkill(cvText, s));
  const missing = required.filter((s) => !hasSkill(cvText, s));
  return { required, have, missing };
}
