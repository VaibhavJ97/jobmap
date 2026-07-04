import { getSql, ensureSchema } from "./db";

// Fallback geocoder for cities not in the static table. Results are cached in
// Postgres so any given place is only looked up once, ever. To respect
// Nominatim's fair-use policy and Vercel's 10s function limit, we cap how many
// live lookups happen per request; everything else is served from cache.
const MAX_LIVE_LOOKUPS = 3;

type Coord = { lat: number; lng: number; city: string };

async function nominatim(query: string): Promise<Coord | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "jobmap/0.1 (portfolio project)" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data.length) return null;
    const hit = data[0];
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      city: hit.display_name.split(",")[0].trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Resolve a batch of location strings. Returns a map from the original string
// to coordinates. Uses the Postgres cache first, then a capped number of live
// Nominatim lookups, writing any new results back to the cache.
export async function geocodeBatch(locations: string[]): Promise<Map<string, Coord>> {
  const result = new Map<string, Coord>();
  const unique = Array.from(new Set(locations.map((l) => l.trim()).filter(Boolean)));
  if (!unique.length) return result;

  const ready = await ensureSchema();
  const sql = getSql();

  // 1) Serve what we can from the cache.
  const misses: string[] = [];
  if (ready && sql) {
    try {
      const rows = await sql`SELECT query, lat, lng, city FROM geocode_cache WHERE query = ANY(${unique})`;
      const cached = new Map(rows.map((r) => [r.query as string, r as unknown as Coord]));
      for (const q of unique) {
        const hit = cached.get(q);
        if (hit) result.set(q, { lat: hit.lat, lng: hit.lng, city: hit.city });
        else misses.push(q);
      }
    } catch {
      misses.push(...unique);
    }
  } else {
    misses.push(...unique);
  }

  // 2) Live-look-up a capped number of misses, caching each result.
  for (const q of misses.slice(0, MAX_LIVE_LOOKUPS)) {
    const coord = await nominatim(q);
    if (!coord) continue;
    result.set(q, coord);
    if (ready && sql) {
      try {
        await sql`
          INSERT INTO geocode_cache (query, lat, lng, city)
          VALUES (${q}, ${coord.lat}, ${coord.lng}, ${coord.city})
          ON CONFLICT (query) DO NOTHING
        `;
      } catch {
        /* caching is best-effort */
      }
    }
  }

  return result;
}
