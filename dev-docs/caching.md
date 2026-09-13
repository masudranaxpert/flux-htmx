# Caching & Deduplication

Flux has two caching layers plus an explicit request deduplication system. The first is the normal HTTP cache, which Flux never bypasses. The second is an optional in-memory client LRU cache with Stale-While-Revalidate (SWR) support for GET responses.

## Layer 1: HTTP caching

HTMX issues standard `fetch` requests, so the browser HTTP cache applies unchanged. Flux does
not add cache-busting query strings, does not set `Cache-Control: no-cache`, and does not
disable conditional requests. Configure caching on the response, exactly as for any HTTP
resource:

- `Cache-Control` — freshness and validation directives (`max-age`, `no-cache`, `must-revalidate`).
- `ETag` / `If-None-Match` — strong/weak validation. A matching tag yields `304 Not Modified`
  with an empty body.
- `Last-Modified` / `If-Modified-Since` — timestamp validation.
- `Vary` — vary the cached response by request header. Important for partial responses, where
  the same URL may return different fragments depending on `HX-Request` or `HX-Target`.

Flux complements the HTTP cache; it does not replace it. A correct `Cache-Control` plus
`ETag` policy is the primary cache for any Flux request.

## Layer 2: Client LRU cache & SWR Mode

For GET requests, Flux can memoize responses in a bounded in-memory LRU cache so that
repeated identical requests are served without a network round-trip. The cache is **GET-only**,
**in-memory** (it is not written to `localStorage` or `sessionStorage`), and **bounded** to a
fixed number of entries with dual-window freshness (fresh TTL vs stale grace window).

Defaults: 128 entries, 60-second TTL.

### Attributes

| Attribute                                | Effect                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `fx-cache`                               | Enable caching for this element. Value is a TTL, e.g. `fx-cache="60s"`.                |
| `fx-cache-mode="stale-while-revalidate"` | Instantly renders cached content during stale grace window, revalidates in background. |
| `fx-cache-key`                           | Override the cache key (default is canonical URL + `GET` method).                      |
| `fx-invalidate`                          | Invalidate cache entries matching a key pattern when a mutation fires.                 |

**Example (Stale-While-Revalidate Dual-Window)**

```html
<div fx-get="/dashboard/summary" fx-cache="5m" fx-cache-mode="stale-while-revalidate">
  <!-- Content renders instantly from cache during fresh (0-5m) and stale window, then updates silently if background fetch changed -->
</div>
```

## Request Deduplication

When multiple elements on a page issue simultaneous identical `GET` requests (e.g. 3 components loading `GET /api/user/profile`), Flux automatically coalesces them into a single HTTP network call and shares the response HTML across all requesting elements.

```html
<div fx-get="/api/user/profile" fx-dedupe="true"></div>
```

### Safety & Header Isolation (`fx-dedupe-vary`)

- **Authorization Isolation**: Any request containing an `Authorization` header automatically bypasses deduplication to prevent cross-account response sharing.
- **Custom Header Isolation**: Specify headers that vary the deduplication key via `fx-dedupe-vary`:

```html
<div fx-get="/api/user/profile" fx-dedupe="true" fx-dedupe-vary="Accept-Language,X-Tenant-ID"></div>
```

### JavaScript API

The cache is exposed as `Flux.cache`. All methods are synchronous.

```ts
interface FluxCache {
  // Read an entry. Options permit allowStale: true for SWR mode.
  get(key: string, options?: { allowStale?: boolean }): string | null;

  // Write an entry with optional TTL and extended stale TTL.
  set(key: string, value: string, ttlMs?: number, staleTtlMs?: number): void;

  // Remove one entry. Returns true if an entry was removed.
  invalidate(key: string): boolean;

  // Remove every entry whose key matches the pattern (substring match).
  invalidateMatching(pattern: string): number;

  // Remove all entries.
  clear(): void;
}
```
