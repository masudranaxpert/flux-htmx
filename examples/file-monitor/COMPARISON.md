# File Monitor: Flux vs raw HTMX

A side-by-side comparison of the two dashboards in this folder (both render identical
fragments from the same server). Numbers are measured, not estimated.

Run it:

```bash
npm run build
node examples/file-monitor/server.mjs
# Flux:    http://localhost:4321/
# Raw:     http://localhost:4321/raw
```

## Template line count

Measured with `wc -l` on the dashboard `<body>` markup (excluding shared boilerplate):

| Variant                     | `index.html` total lines | Declarative attribute lines                                  |
| --------------------------- | ------------------------ | ------------------------------------------------------------ |
| Flux (`flux/index.html`)    | 22                       | 4 (`fx-load`, `fx-target`, `fx-cache`, `fx-cache-key`)       |
| Raw HTMX (`raw/index.html`) | 25                       | 6 (`hx-get`, `hx-trigger`, `hx-target`, `hx-swap`, repeated) |

Flux is shorter on the stat-loading pattern because `fx-load` folds the verb + trigger into
one attribute. The gap widens as more presets (`fx-search`, `fx-submit`, `fx-delete`) are
used.

## Custom JavaScript

| Variant  | Custom JS lines |
| -------- | --------------- |
| Flux     | 0               |
| Raw HTMX | 0               |

Neither requires custom JavaScript for this dashboard — both are pure declarative HTMX.
Flux's value here is conciseness and the cache invalidation wiring, not JS reduction.

## Bundle size (measured)

From `npm run size`:

| Asset                                      | Raw      | Gzip     |
| ------------------------------------------ | -------- | -------- |
| `flux.iife.js` (Flux only, htmx external)  | 13.06 kB | 4.56 kB  |
| `flux.full.iife.js` (htmx + Alpine + Flux) | 93.58 kB | 31.93 kB |
| Raw HTMX (`htmx.min.js`)                   | ~14 kB   | ~5 kB    |

For an HTMX-only app, raw HTMX is smaller. Flux's overhead on top of HTMX is the Flux-only
runtime (~4.5 kB gzip). The full bundle is larger because it bundles Alpine too.

## What Flux hides

- The `hx-trigger="load"` boilerplate (folded into `fx-load`).
- The debounce/race-protection wiring for search (`fx-search` → `changed delay + sync:replace`).
- Cache invalidation plumbing (`fx-invalidate`).
- Status-code routing (`fx-on-422`).

## What Flux deliberately does not hide

- The URL and HTTP method — always visible in `fx-get`/`fx-post`/`fx-delete`.
- The target element — `fx-target` is explicit.
- The swap behaviour — `fx-swap` is opt-in, never magical.
- Raw HTMX is always available; `hx-*` wins over `fx-*` on conflict.

## Maintainability

Flux presets encode best-practice HTMX patterns once (debounce, race protection, cache keys)
so individual templates can't get them wrong. The trade-off is learning what each preset
expands to — documented in `docs/presets.md` and inspectable via `flux-ui inspect`.

## Accessibility

Both variants use the same semantic HTML fragments, so accessibility is identical: the
exceptions table uses `<table>`/`<thead>`, the stats use real headings, and Flux's
`flux-table[data-responsive]` adds card layout via container queries without changing
semantics. No JS-driven focus tricks in either.

## Runtime performance

Not benchmarked beyond build size in this phase. A dedicated performance suite (startup,
100/1k/5k elements, repeated swaps, cache hit/miss) is planned for a later release-quality
pass — see `docs/performance.md`. No performance claims are made here beyond the measured
bundle sizes above.
