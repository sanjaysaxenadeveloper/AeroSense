import type { NextRequest } from "next/server";

interface BucketEntry {
  timestamps: number[];
}

const MAX_TRACKED_KEYS = 500;
const store = new Map<string, BucketEntry>();

export function getClientIdentifier(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const raw = forwardedFor.split(",")[0].trim().replace(/^::ffff:/i, "");
    return (raw || "unknown").slice(0, 64);
  }
  const realIp = req.headers.get("x-real-ip")?.trim().replace(/^::ffff:/i, "");
  return (realIp || "local-client").slice(0, 64);
}

/**
 * Sliding-window rate limiter protecting API routes from burst abuse.
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const safeId = identifier.slice(0, 128);
  const now = Date.now();
  const windowStart = now - windowMs;

  if (store.size >= MAX_TRACKED_KEYS) {
    for (const [k, v] of store.entries()) {
      const recent = v.timestamps.filter((ts) => ts > windowStart);
      if (recent.length === 0) {
        store.delete(k);
      }
    }
    if (store.size >= MAX_TRACKED_KEYS) {
      const firstKey = store.keys().next().value;
      if (firstKey) store.delete(firstKey);
    }
  }

  const existing = store.get(safeId);
  const recentTimestamps = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (recentTimestamps.length >= maxRequests) {
    const oldest = recentTimestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    store.set(safeId, { timestamps: recentTimestamps });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  recentTimestamps.push(now);
  store.set(safeId, { timestamps: recentTimestamps });

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - recentTimestamps.length),
    retryAfterSeconds: 0,
  };
}
