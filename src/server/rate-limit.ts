/**
 * Fixed-window in-memory rate limiter.
 *
 * LIMITATION: state is per server process. It protects a single instance (dev, a single container);
 * behind several instances or serverless, swap `store` for a shared backend (Redis/Upstash/Postgres).
 */
import { AppError } from "@/server/errors";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  if (store.size > 10_000) for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { allowed: true, retryAfterSec: 0 };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const r = checkRateLimit(key, limit, windowMs);
  if (!r.allowed) throw new AppError("rate_limited", `Too many attempts. Try again in ${r.retryAfterSec}s.`);
}

export function resetRateLimits(): void {
  store.clear();
}
