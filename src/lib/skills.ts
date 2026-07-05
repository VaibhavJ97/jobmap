// Shared skill vocabulary. Used both by the filter panel and the Check/Match
// skills-gap comparison, so there is one source of truth for the term list.
// Order here is the display order (Software Dev first, GIS last).
export const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  {
    label: "Software Development",
    skills: [
      "javascript",
      "typescript",
      "python",
      "java",
      "c#",
      ".net",
      "c++",
      "go",
      "rust",
      "php",
      "ruby",
      "react",
      "vue",
      "angular",
      "node",
      "next.js",
      "spring",
      "html",
      "css",
      "sass",
      "graphql",
      "rest api",
      "git",
      "docker",
      "kubernetes",
      "ci/cd",
    ],
  },
  {
    label: "Data Analysis",
    skills: [
      "sql",
      "excel",
      "power bi",
      "tableau",
      "looker",
      "pandas",
      "numpy",
      "matplotlib",
      "statistics",
      "jupyter",
      "data visualization",
      "a/b testing",
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
      "redshift",
      "dbt",
      "postgres",
      "mongodb",
      "redis",
      "elasticsearch",
      "aws",
      "azure",
      "gcp",
      "terraform",
    ],
  },
  {
    label: "IT / Systems & Support",
    skills: [
      "it support",
      "help desk",
      "helpdesk",
      "troubleshooting",
      "linux",
      "linux admin",
      "system administration",
      "sysadmin",
      "windows server",
      "active directory",
      "office 365",
      "networking",
      "tcp/ip",
      "vpn",
      "firewall",
      "itil",
      "bash",
      "powershell",
      "vmware",
      "ansible",
      "jira",
    ],
  },
  {
    label: "GIS / Geospatial",
    skills: [
      "gis",
      "qgis",
      "arcgis",
      "arcpy",
      "google earth engine",
      "postgis",
      "geospatial",
      "spatial analysis",
      "remote sensing",
      "gdal",
      "geopandas",
      "leaflet",
      "mapbox",
      "cartography",
      "gps",
      "lidar",
    ],
  },
];

// Flat list of every known skill term.
export const SKILL_TERMS: string[] = SKILL_GROUPS.flatMap((g) => g.skills);

// Whole-word-ish presence test. For short/ambiguous terms (r, go, c#, c++) we
// require boundaries so "r" doesn't match inside "developer" and "go" doesn't
// match inside "google".
export function hasSkill(text: string, skill: string): boolean {
  const s = skill.toLowerCase();
  const boundary = s.length <= 2 || s === "c++" || s === "c#" || s === "go" || s === "r";
  if (boundary) {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+#])${esc}([^a-z0-9+#]|$)`, "i").test(` ${text} `);
  }
  return ` ${text.toLowerCase()} `.includes(s);
}

// Compare a job's text against a CV's text and return the skill breakdown.
export function skillGap(jobText: string, cvText: string) {
  const required = SKILL_TERMS.filter((s) => hasSkill(jobText, s));
  const have = required.filter((s) => hasSkill(cvText, s));
  const missing = required.filter((s) => !hasSkill(cvText, s));
  return { required, have, missing };
}
