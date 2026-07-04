import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiter for the public search endpoint. Degrades gracefully: if the
// Upstash env vars aren't set, limiting is simply skipped so search never
// breaks over a config issue.
let _limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (_limiter !== undefined) return _limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _limiter = null;
    return null;
  }
  _limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 12 searches per minute per visitor — comfortable for humans, hostile to bots.
    limiter: Ratelimit.slidingWindow(12, "60 s"),
    prefix: "jobmap:search",
    analytics: false,
  });
  return _limiter;
}

// Best-effort client IP from the request headers Vercel sets.
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "anonymous";
}

// Returns true if the request is allowed. If no limiter is configured, always allows.
export async function allowRequest(ip: string): Promise<boolean> {
  const limiter = getLimiter();
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit(ip);
    return success;
  } catch {
    // If Redis is unreachable, fail open rather than block real users.
    return true;
  }
}
