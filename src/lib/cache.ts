/**
 * Tiny in-memory TTL cache (stand-in for Redis in the sandbox).
 * Per spec §5.4 — used for paste metadata, auth lookups and rate limiting.
 *
 * NOTE: state lives in the Node.js process. With several instances behind a
 * load balancer each instance keeps its own cache and rate-limit buckets.
 */
type Entry = { value: unknown; expiresAt: number }

const store = new Map<string, Entry>()

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    store.delete(key)
    return null
  }
  return entry.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function cacheDel(key: string): void {
  store.delete(key)
}

/** Invalidate all keys matching a prefix. */
export function cacheDelPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

/** Sliding-window rate limiter (per spec §8 — login, paste creation, API keys). */
const rateBuckets = new Map<string, number[]>()

export function rateLimitHit(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const arr = rateBuckets.get(key) ?? []
  const fresh = arr.filter((t) => t > now - windowMs)
  if (fresh.length >= max) {
    rateBuckets.set(key, fresh)
    return true
  }
  fresh.push(now)
  rateBuckets.set(key, fresh)
  return false
}

// Periodically drop expired cache entries and idle rate-limit buckets so the
// maps don't grow without bound on a long-running server.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const globalForSweep = globalThis as unknown as { __psCacheSweep?: ReturnType<typeof setInterval> }
if (!globalForSweep.__psCacheSweep) {
  globalForSweep.__psCacheSweep = setInterval(() => {
    const now = Date.now()
    for (const [k, e] of store) if (e.expiresAt < now) store.delete(k)
    for (const [k, times] of rateBuckets) {
      if (!times.length || times[times.length - 1] < now - 60 * 60 * 1000) rateBuckets.delete(k)
    }
  }, SWEEP_INTERVAL_MS)
  globalForSweep.__psCacheSweep.unref?.()
}
