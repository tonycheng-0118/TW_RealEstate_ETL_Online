/**
 * In-memory rate limiter for serverless environment.
 * Tracks request counts per IP with a sliding window.
 * Note: Each serverless instance has its own Map, so limits
 * are approximate in a multi-instance setup. Acceptable for MVP.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10; // 10 requests per window

// In-memory store — resets when the serverless instance cold-starts
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Check if a given IP has exceeded the rate limit.
 * Returns { allowed: true } if within limit, or
 * { allowed: false, retryAfterMs } if exceeded.
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // No existing entry or window expired — allow and start new window
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true };
  }

  // Within window — check count
  if (entry.count < MAX_REQUESTS) {
    entry.count++;
    return { allowed: true };
  }

  // Rate limit exceeded
  return { allowed: false, retryAfterMs: entry.resetTime - now };
}

// Periodic cleanup to prevent memory leak from stale entries.
// Runs every 5 minutes, removes expired entries.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now >= entry.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}
