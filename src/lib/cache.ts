/**
 * Tiny in-memory TTL cache (stand-in for Redis in the sandbox).
 * Per spec §5.4 — used for paste metadata + rendered content + view counters.
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

/** Sliding-window-ish rate limiter (per spec §8 — login + paste creation). */
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

/** Pending view-counter increments (flushed periodically to DB). */
const viewCounter = new Map<string, number>()

export function viewCounterIncr(pasteId: string): void {
  viewCounter.set(pasteId, (viewCounter.get(pasteId) ?? 0) + 1)
}

export function viewCounterDrain(): Map<string, number> {
  const drained = new Map(viewCounter)
  viewCounter.clear()
  return drained
}
