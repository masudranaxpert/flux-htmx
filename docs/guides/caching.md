---
title: Caching
---

# Fragment caching

Flux caches htmx GET responses in memory (LRU) and replays them without a network
round-trip.

```html
<!-- Cache this response for the default TTL -->
<section fx-load="/stats" fx-cache>…</section>

<!-- Custom TTL and key -->
<section fx-load="/stats" fx-cache="300s" fx-cache-key="stats-v1">…</section>

<!-- Vary the key per user/language -->
<section fx-load="/stats" fx-cache fx-cache-vary="user,lang">…</section>
```

## Key canonicalisation

The key is `METHOD:path?sorted=params`. Parameters are sorted, merged from the query
string and the request payload, and **sensitive values are hashed** — a `password`
or `token` field contributes `name=~hash` to the key, so:

- two requests differing only in a secret get **different** entries (no wrong-data
  collisions), and
- the raw secret never appears in the key.

`fx-cache-vary` narrows the key to the listed fields; sensitive fields stay hashed
even when listed.

## Programmatic control

```js
Flux.cache.invalidate('/products/*'); // wildcard
Flux.cache.clear();                   // everything
Flux.cache.get('GET:/stats');         // read
Flux.cache.set('GET:/stats', '<div>…</div>');
```

## Cache coherence

After a mutating request, invalidate affected entries declaratively:

```html
<form fx-submit="/users" fx-invalidate="/users/*">…</form>
```

Prefetched responses land in the same cache under the same key as real requests —
prefetch is a **guaranteed** first-click hit. See [prefetch](prefetch.md).

## What is cacheable

- `GET` requests only
- 2xx responses with cacheable content types (`text/html` by default; extend with
  `fx-allowed-types`)
- Responses you have not opted out with `fx-cache="0"`

Eviction is LRU, bounded by `fx-max-size`.
