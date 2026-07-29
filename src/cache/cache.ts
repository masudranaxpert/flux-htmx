// Bounded in-memory fragment cache. GET-only by default, with TTL, byte size cap, dual-window SWR, and LRU eviction.
// Complements HTTP caching rather than replacing it — see docs/caching.md.

export interface CacheEntry {
  value: string;
  expiresAt: number;
  staleUntil: number;
  // Monotonic insertion counter for LRU ordering.
  order: number;
  byteSize: number;
}

export interface CacheResult {
  value: string;
  isStale: boolean;
}

export interface CacheOptions {
  /** Maximum number of entries. Default 128. */
  maxEntries?: number;
  /** Maximum total byte size. Default 5MB (5,242,880 bytes). */
  maxBytes?: number;
  /** Default TTL in ms when not given per-entry. Default 60_000. */
  defaultTtlMs?: number;
}

const DEFAULTS = {
  maxEntries: 128,
  maxBytes: 5 * 1024 * 1024,
  defaultTtlMs: 60_000,
} as const;

export class FragmentCache {
  private store = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly defaultTtlMs: number;
  private counter = 0;
  private currentBytes = 0;

  constructor(options: CacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULTS.maxEntries;
    this.maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULTS.defaultTtlMs;
  }

  get(key: string, options: { allowStale?: boolean; returnMeta: true }): CacheResult | null;
  get(key: string, options?: { allowStale?: boolean; returnMeta?: false }): string | null;
  get(
    key: string,
    options?: { allowStale?: boolean; returnMeta?: boolean },
  ): string | CacheResult | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now >= entry.staleUntil) {
      this.currentBytes -= entry.byteSize;
      this.store.delete(key);
      return null;
    }

    const isFresh = now < entry.expiresAt;
    if (!isFresh && !options?.allowStale) {
      return null;
    }

    // LRU: refresh recency on access.
    entry.order = ++this.counter;
    if (options?.returnMeta) {
      return {
        value: entry.value,
        isStale: !isFresh,
      };
    }
    return entry.value;
  }

  set(key: string, value: string, ttlMs?: number, staleTtlMs?: number): void {
    const existing = this.store.get(key);
    if (existing) {
      this.currentBytes -= existing.byteSize;
    }
    const byteSize =
      typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(value).length
        : value.length * 2;
    const ttl = ttlMs ?? this.defaultTtlMs;
    const staleTtl = staleTtlMs ?? ttl * 5;
    const now = Date.now();

    this.store.set(key, {
      value,
      expiresAt: now + ttl,
      staleUntil: now + staleTtl,
      order: ++this.counter,
      byteSize,
    });
    this.currentBytes += byteSize;
    this.evict();
  }

  invalidate(key: string): boolean {
    const entry = this.store.get(key);
    if (entry) {
      this.currentBytes -= entry.byteSize;
      return this.store.delete(key);
    }
    return false;
  }

  /** Removes every key matching a simple wildcard pattern (`*` wildcard; `?` is treated as literal URL delimiter). */
  invalidateMatching(pattern: string): number {
    const regex = wildcardToRegExp(pattern);
    let removed = 0;
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (regex.test(key)) {
        this.currentBytes -= entry.byteSize;
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
    this.currentBytes = 0;
  }

  get size(): number {
    return this.store.size;
  }

  get totalBytes(): number {
    return this.currentBytes;
  }

  /** Evicts the least-recently-used entry until under entry and byte caps, ignoring already-expired. */
  private evict(): void {
    // First drop expired entries opportunistically.
    if (this.store.size > this.maxEntries || this.currentBytes > this.maxBytes) {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.store.entries())) {
        if (now >= entry.staleUntil) {
          this.currentBytes -= entry.byteSize;
          this.store.delete(key);
        }
      }
    }
    // Then evict by LRU if still over entry or byte cap.
    while (this.store.size > this.maxEntries || this.currentBytes > this.maxBytes) {
      let oldestKey: string | null = null;
      let oldestOrder = Infinity;
      let oldestByteSize = 0;
      for (const [key, entry] of this.store) {
        if (entry.order < oldestOrder) {
          oldestOrder = entry.order;
          oldestKey = key;
          oldestByteSize = entry.byteSize;
        }
      }
      if (oldestKey === null) break;
      this.currentBytes -= oldestByteSize;
      this.store.delete(oldestKey);
    }
  }
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** The cache is GET-only by default; this guards the few entry points that write. */
export function isCacheableMethod(method: string): boolean {
  return method.toUpperCase() === 'GET';
}
