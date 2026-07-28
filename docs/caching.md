# Caching

Flux has two caching layers. The first is the normal HTTP cache, which Flux never bypasses.
The second is an optional in-memory client cache for GET responses. The two are complementary,
not redundant.

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

## Layer 2: client LRU cache (optional)

For GET requests, Flux can memoize responses in a bounded in-memory LRU cache so that
repeated identical requests are served without a network round-trip. The cache is **GET-only**,
**in-memory** (it is not written to `localStorage` or `sessionStorage`), and **bounded** to a
fixed number of entries with a per-entry TTL.

Defaults: 128 entries, 60-second TTL.

### Attributes

| Attribute       | Effect                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| `fx-cache`      | Enable caching for this element. Value is a TTL, e.g. `fx-cache="60s"`. |
| `fx-cache-key`  | Override the cache key (default is the request URL + `GET` method).     |
| `fx-invalidate` | Invalidate cache entries matching a key pattern when this fires.        |

**Example**

```html
<button fx-get="/dashboard" fx-target="#dash" fx-cache="60s">Refresh</button>
<button fx-post="/dashboard/reset" fx-invalidate="/dashboard">Reset</button>
```

The GET response is cached for 60 seconds; the POST invalidates any cached entry whose key
matches `/dashboard`.

### JavaScript API

The cache is exposed as `Flux.cache`. All methods are synchronous.

```ts
interface FluxCache {
  // Read an entry. Returns undefined on miss or expiry.
  get(key: string): CacheEntry | undefined;

  // Write an entry. TTL defaults to the configured default (60s).
  set(key: string, value: CacheEntry, ttlMs?: number): void;

  // Remove one entry. Returns true if an entry was removed.
  invalidate(key: string): boolean;

  // Remove every entry whose key matches the pattern (substring match).
  invalidateMatching(pattern: string): number;

  // Remove all entries.
  clear(): void;
}
```

`CacheEntry` carries the cached response body and metadata (status, headers) sufficient to
replay the swap without a network request.

### When to use it

Use the client cache for GET endpoints that are expensive to compute and tolerate short-term
staleness (dashboards, typeahead option lists, reference data). Do not use it for
mutating endpoints, for personalised data that changes per request, or as a substitute for a
correct HTTP cache policy.
