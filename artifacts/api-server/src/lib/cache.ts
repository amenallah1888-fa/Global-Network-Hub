type CacheEntry<T> = { value: T; expiresAt: number };

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.value;
  }

  invalidate(key: string): void { this.store.delete(key); }

  invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) { if (k.startsWith(prefix)) this.store.delete(k); }
  }

  size(): number { return this.store.size; }
}

export const cache = new MemoryCache();

export const TTL = {
  SHORT: 30_000,
  MEDIUM: 5 * 60_000,
  LONG: 30 * 60_000,
  FEED: 15_000,
  NOTIFICATIONS: 10_000,
};
