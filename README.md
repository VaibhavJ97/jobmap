# JobMap

European tech job search across multiple sources — ranked by relevance and plotted on an interactive map. Built with Next.js, TypeScript, and Node.

Part of [my portfolio](https://vaibhavj97.vercel.app/). Search real jobs, see them on a map of Germany/Europe, click a marker to open the role.

## Credits

The relevance-ranking and deduplication approach is adapted from the open-source
[EuroJobSearch](https://github.com/teokitten/eurojobsearch) aggregator (MIT). This is an
independent reimplementation in a Next.js / TypeScript stack, with a map view, a job-detail
route, and additional sources.

## Tech stack

- **Next.js (App Router) + React + TypeScript** — UI and API route
- **Node.js** — the `/api/search` route: parallel fetch, dedupe, relevance ranking
- **Leaflet / react-leaflet** — interactive map with per-city job markers
- **Zod** — request validation
- Deployed free on **Vercel**

## Sources (Phase 1)

All key-free public APIs, queried in parallel:

- **Remotive** — remote roles
- **Arbeitnow** — Germany/Austria/Switzerland
- **Arbeitsagentur** — the German Federal Employment Agency (best-effort; large German coverage)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and search (e.g. `backend developer` or `data analyst`).
No environment variables are needed for Phase 1.

## Deploy to Vercel

1. Push this repo to GitHub.
2. On vercel.com: **Add New → Project** → import the repo → **Deploy** (framework auto-detected as Next.js).
3. Done — you get a live URL. No env vars required for Phase 1.

## Roadmap

- **Phase 1 (this):** search + relevance ranking + map + job-detail page.
- **Phase 1b:** Nominatim geocoding fallback + Postgres (Neon) geocode cache; application tracker in Postgres.
- **Phase 2:** LLM job summaries + tailored application bullets (provider-agnostic), streamed.
- **Phase 3:** RAG — CV upload, pgvector embeddings, semantic job matching.
- **Phase 4:** application-assistant agent + MCP server (Python microservice, Dockerized, GitHub Actions CI).

## License

MIT. Retains attribution to the original EuroJobSearch project (see Credits).
