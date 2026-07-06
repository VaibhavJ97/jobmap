# JobMap - Every European Tech Job, on One Map

> Search European tech jobs across many free sources at once, ranked by relevance and plotted on an interactive map. Upload a CV and check any role against it with a Gemini-powered skills match. Built on Next.js + Postgres + Google Gemini.

**Live**: [vaibhavj97-jobmap.vercel.app](https://vaibhavj97-jobmap.vercel.app)

## What this is

A full-stack job aggregator that replaces tab-hopping across a dozen job boards with one search and one filterable view. Type a role and location, and JobMap queries many free job sources in parallel, deduplicates the results, ranks them by relevance, and plots each one on a map of Europe. Then it does two things a plain job board does not:

- **Filters that compose live** - narrow by language, region, skills, and source, with counts that update as you go
- **CV matching** - upload a CV once and compare it to any job for a skills match, powered by Google Gemini with a keyword fallback, plus a semantic "Match my CV" pass over the whole result set using vector embeddings

For anyone job-hunting in European tech who is tired of opening the same search in ten different tabs.

## How this was built - AI-pair-programming disclosure

This project was built with **AI-assisted development workflows**. Anthropic Claude was my primary pair-programmer for the multi-source fan-out, the relevance ranking, the location-aware deduplication, the pgvector CV matching, the Leaflet map, and the auth and rate-limiting layers. GitHub Copilot handled inline suggestions.

**What was mine**: the product idea (one map, honest sources, on-demand AI), the architecture, the decision about which job sources are actually free and safe to call from a server, the decision to exclude scraping of Indeed and LinkedIn (against their terms and unreliable on datacenter IPs), the caching and gated-AI strategy that keeps it inside free tiers, the location-aware dedupe design, and every line review before deployment.

**What AI accelerated**: the parallel source integrations, the Next.js route handlers, the pgvector queries, the Leaflet clustering, the test suite scaffolding, and the responsive UI work.

AI accelerated the writing; the decisions stayed mine.

## Architecture

```
Browser (Next.js App Router + React UI + Leaflet map)
   |
   v
Next.js route handlers on Vercel (Node.js serverless)
   |
   +-- /api/search
   |     +-- fetch many sources in parallel (Promise.all, no scraping)
   |     |     +-- Public APIs: Arbeitsagentur, Arbeitnow, Remotive,
   |     |     |   Jobicy, Remote OK, We Work Remotely, The Muse
   |     |     +-- ATS boards: Greenhouse, Lever, Ashby, Workable,
   |     |         Recruitee, SmartRecruiters
   |     +-- deduplicate by title + company + location
   |     +-- rank by relevance
   |     +-- geocode cities for the map
   |
   +-- /api/cv       -> parse + embed CV (Gemini embeddings) -> Postgres (pgvector)
   +-- /api/match    -> semantic cosine match over shown jobs (pgvector)
   +-- /api/skills   -> per-job skills check (Gemini JSON, keyword fallback, cached)
   +-- /api/tracker  -> save / list shortlisted jobs
   +-- /api/[...nextauth] + /api/register -> email auth
   |
   v
Neon Postgres (pgvector)  ·  Upstash Redis (rate limiting)  ·  Google Gemini
```

Fast API sources only, fired in parallel to stay inside Vercel's serverless time limit. No scraping, no headless browsers.

## Tech stack

| Layer | What |
|---|---|
| Framework | Next.js (App Router) with TypeScript and React |
| Map | Leaflet with CARTO Positron tiles and marker clustering |
| Sources | Free, keyless job APIs + public ATS boards, fetched in parallel |
| Backend | Next.js route handlers (Node.js) on Vercel |
| Database | Neon Postgres with pgvector for CV embeddings |
| AI matching | Google Gemini (skills check + embeddings), keyword fallback |
| Auth | Auth.js (next-auth) email sign-in with bcrypt |
| Rate limiting | Upstash Redis (sliding window) |
| Testing | Vitest unit tests |
| CI | GitHub Actions (type-check, tests, build on every push) |
| Analytics | Vercel Analytics + Speed Insights |
| Hosting | Vercel |
| Development | AI-pair-programming (Claude, Copilot) with full manual review |
| Cost | **0 EUR/month** at portfolio scale (free tiers throughout) |

## Features

- Multi-source search fired in parallel, results merged into one view
- Location-aware deduplication (same title + company in different cities stay distinct; cross-board copies of the same city role merge)
- Relevance ranking of every posting
- Interactive Leaflet map with marker clustering; click a marker to open the original posting
- Composable filters: language, region, categorized skills, and source chips, all with live counts
- "Load more" pagination that digs deeper into the paginated sources
- CV upload (PDF, Word, or paste), stored per account
- **Check match**: per-job skills comparison against your CV (Gemini, with a keyword fallback and cached responses)
- **Match my CV**: semantic pass over the whole result set using pgvector cosine similarity
- Save jobs to a shortlist that persists per account
- Email sign-in, in-page sign-in modal
- Mobile-responsive

## How it works

1. You type a role and an optional location and hit search
2. `/api/search` fans out to many job sources in parallel in a single request
3. Results are deduplicated by title, company, and location, then ranked by relevance and geocoded for the map
4. Filters (language, region, skills, source) apply on the client and update their counts live
5. Upload a CV once. It is parsed and embedded (Gemini embeddings) and stored per account in Postgres
6. **Check match** on any card sends that job plus your CV to Gemini for a strict-JSON skills breakdown (have / missing / fit), cached to save quota, with a keyword-based fallback if the model is unavailable
7. **Match my CV** scores the whole result set at once using pgvector cosine similarity
8. Save interesting roles to a shortlist, or open the original posting in one click

## Why parallel APIs instead of scraping

Vercel serverless functions have a short execution window, so every source has to be a fast API call and they all fire together with `Promise.all`. Scraping Indeed or LinkedIn would violate their terms, break constantly on datacenter IPs, and blow past the time limit. Instead, JobMap uses only sources that expose a free, keyless API or public board endpoint, and it is honest about that trade-off: fewer sources, but reliable, fast, and within terms.

## Why caching and gated AI

The only paid-shaped resource is the Gemini API. To stay inside the free tier, AI features are gated behind sign-in and rate-limited with Upstash Redis, every AI result is cached in Postgres keyed by user and job, and the expensive CV description fetch happens on demand only when you actually check a match. The search itself stays fast because it never waits on the model.

## Run locally

```bash
git clone https://github.com/VaibhavJ97/jobmap.git
cd jobmap
npm install
npm run dev
# Open http://localhost:3000
```

Create a `.env.local` with:

```
DATABASE_URL=your_neon_postgres_url
AUTH_SECRET=your_auth_secret
AUTH_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
GEMINI_API_KEY=your_gemini_key
```

The database needs the pgvector extension enabled once:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Search works without any of these keys; auth, CV matching, and the skills check need the database, Redis, and Gemini values. Get a free Gemini API key from [ai.google.dev](https://ai.google.dev).

## Deploy your own

1. Fork this repo
2. Connect it to a new Vercel project
3. Add the environment variables above in the Vercel project settings
4. Provision a Neon Postgres database, enable pgvector, and point `DATABASE_URL` at it
5. Push to `main`. Vercel auto-deploys.

## Testing and CI

```bash
npm run test        # Vitest unit tests
npx tsc --noEmit    # type-check
npm run build       # production build
```

Unit tests cover relevance ranking, deduplication, language and region classification, and the skills logic. GitHub Actions runs the type-check, the tests, and the build on every push.

## Project structure

```
.
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main search UI, filters, map, explainer sections
│   │   ├── layout.tsx            # Root layout, nav, footer, fonts, metadata
│   │   ├── globals.css
│   │   ├── providers.tsx         # Session provider
│   │   ├── login/page.tsx        # Sign-in fallback page
│   │   ├── jobs/[id]/page.tsx    # Job detail fallback
│   │   └── api/
│   │       ├── search/route.ts   # Multi-source fan-out, dedupe, rank
│   │       ├── cv/route.ts       # CV upload + embedding
│   │       ├── match/route.ts    # Semantic CV match (pgvector)
│   │       ├── skills/route.ts   # Per-job skills check (Gemini + fallback)
│   │       ├── tracker/route.ts  # Save / list shortlist
│   │       ├── register/route.ts # Account creation
│   │       └── [...nextauth]/route.ts
│   ├── components/               # Nav, Footer, SearchForm, Filters,
│   │                             #   JobList, JobCard, JobMap, MapView,
│   │                             #   CvUpload, AuthModal
│   ├── lib/
│   │   ├── sources.ts            # All job-source integrations + fan-out
│   │   ├── dedupe.ts             # Location-aware deduplication
│   │   ├── ranking.ts            # Relevance scoring
│   │   ├── skills.ts             # Skills vocabulary + gap analysis
│   │   ├── match.ts / embed.ts   # Semantic matching + embeddings
│   │   ├── cv.ts                 # CV parsing (PDF / Word / paste)
│   │   ├── llm.ts / ai.ts        # Gemini prompts + client helpers
│   │   ├── db.ts / tracker.ts    # Postgres access
│   │   ├── geocode.ts / geocodeCache.ts
│   │   ├── rateLimit.ts          # Upstash Redis limits
│   │   ├── types.ts
│   │   └── __tests__/            # Vitest suite
│   └── auth.ts                   # Auth.js config
├── public/                       # og-jobmap.png, static assets
├── .github/workflows/ci.yml      # Type-check, tests, build
├── package.json
└── README.md
```

## Data sources

JobMap only uses sources that expose a free, keyless API or public board endpoint:

- **Public job APIs**: Arbeitsagentur (main German source), Arbeitnow, Remotive, Jobicy, Remote OK, We Work Remotely (RSS), The Muse. Adzuna is supported and stays dormant unless its keys are set.
- **ATS company boards** (public JSON): Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters.

**Deliberately excluded**: Indeed, LinkedIn, Glassdoor, StepStone. None expose a free server API; using them would require scraping, which violates their terms, is unreliable from datacenter IPs, and exceeds the serverless time budget. JobMap chooses fewer sources over dishonest ones.

Source coverage skews toward Germany and remote roles because that is where the free APIs are strongest.

## Limitations

- Source coverage is limited to free, keyless APIs, so it is not exhaustive; large paid boards are absent by design
- Arbeitsagentur keyword matching is broad, so a wide term can surface some non-tech roles
- AI features (Check match, Match my CV) require sign-in and are rate-limited to stay inside free tiers
- The Gemini skills check is generated text; it falls back to keyword analysis when the model is unavailable, and results should be sanity-checked
- Free-tier limits apply across Gemini, Neon, Upstash, and Vercel

## Disclaimer

JobMap is a personal portfolio project, not a commercial job board. Job listings come from third-party sources and may be stale, duplicated, or incomplete despite the deduplication step. Always confirm details on the original posting before applying. The CV matching and skills check are AI-generated guidance, not a hiring decision or a guarantee of fit. Nothing here is career or legal advice.

## License

MIT

## About me / Contact

- **Email**: vaibhavjaiswal1234@gmail.com
- **Portfolio**: [vaibhavj97.vercel.app](https://vaibhavj97.vercel.app)
- **LinkedIn**: [linkedin.com/in/vaibhavgeo](https://www.linkedin.com/in/vaibhavgeo/)
- **GitHub**: [github.com/VaibhavJ97](https://github.com/VaibhavJ97)
- **Book a 30-min call**: [calendly.com/vaibhavjaiswal1234/30min](https://calendly.com/vaibhavjaiswal1234/30min)
- **Location**: Karlsruhe, Germany

### My other repos

- [Portfolio homepage](https://github.com/VaibhavJ97/VaibhavJ97.github.io) - the front door
- [Master Thesis Project](https://github.com/VaibhavJ97/kit-master-thesis-portfolio) - climate-projected geothermal potential, GIS and Python
- [GeoChat](https://github.com/VaibhavJ97/geochat) - AI chatbot grounded in the thesis
- [BHE Recommender](https://github.com/VaibhavJ97/bhe-recommender) - interactive geothermal feasibility tool
