---
title: Prefetch
---

# Prefetch — instant clicks

```html
<a hx-get="/product/42" hx-target="#main" fx-prefetch>View Product</a>
```

`fx-prefetch` fetches the URL on `mouseenter`, `touchstart` or `focusin` and stores
the response in the [fragment cache](caching.md). When the user clicks, the response
is already there.

## The contract

Prefetched responses follow **exactly the same conventions as real requests**:

- credentials and CSRF configuration respected
- `HX-Target`, `HX-Trigger`, `HX-Current-URL` headers sent
- request timeout applied
- cache key computed from **method + path + parameters** — identical to what the real
  request computes

That last point is the important one: `/search?q=a` and `/search?q=b` are prefetched
into different entries, and the click hits the one that matches. A prefetch is a
guaranteed first-click hit, not a maybe.

## Etiquette

- Prefetch fires once per hover session — no re-fetch loop while the pointer rests.
- Combined with `fx-cache`, the prefetched TTL governs how long the entry stays warm.
- Only GET semantics are prefetched; mutations are never touched.
