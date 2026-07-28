# Performance

This document states the measured bundle sizes, the budget Flux is held to, and — honestly —
which performance work is verified versus planned.

## Measured bundle sizes

Sizes are for the production builds produced by `npm run build`. Minified size is the raw
file; gzip size assumes default gzip/Brotli-class text compression over the minified file.

| Asset               | Minified | Gzip     |
| ------------------- | -------- | -------- |
| `flux.iife.js`      | 13.06 kB | 4.56 kB  |
| `flux.full.iife.js` | 93.58 kB | 31.93 kB |
| `flux.css`          | 5.5 kB   | 1.82 kB  |

`flux.full.iife.js` is dominated by HTMX 4 and Alpine; the Flux-specific portion of the full
bundle is the same code counted in `flux.iife.js`.

## Performance budget

The budget the core build is held to:

- **Core size.** The Flux core (no HTMX, no Alpine) stays under 8 kB min+gzip. The current
  4.56 kB gzip figure is within budget.
- **No long tasks.** No synchronous work in the request, swap, or expansion path may exceed
  50 ms on the target-class hardware. Expansion is a single DOM-subtree scan per
  `htmx:before:process` event.
- **No `MutationObserver`.** Flux hooks the HTMX lifecycle via one document-level
  `htmx:before:process` listener and does not install a DOM watcher. Swapped content is
  re-processed because HTMX itself calls `process()` on it, which re-fires the event.
- **Bounded cache.** The optional client LRU is bounded (default 128 entries, 60 s TTL), so
  memory growth from caching is capped regardless of traffic.

These are design constraints verified by code review and the existing test suite, not by a
benchmark harness (see below).

## What is verified today

- Unit and browser tests confirm one request per interaction (no duplicate handlers) and that
  expansion is idempotent on repeated `Flux.process()` calls.
- Bundle sizes above are read from the built artifacts, not estimated.
- No `MutationObserver` and no `eval` / `new Function` in Flux itself is enforced by source
  review and the CSP test path.

## What is not yet implemented

A dedicated performance benchmark suite is **planned but not yet implemented**. The intended
matrix is:

- Element counts of 100, 1 000, and 5 000 expanded `fx-*` elements in a single subtree.
- Repeated swaps of a fixed subtree to measure steady-state expansion cost.
- Memory after sustained polling/swap loops, to confirm the bounded-cache guarantee and check
  for listener or closure leaks.

Until that suite exists, the 50 ms long-task goal and the memory-bounds claim should be read
as design intent, not as measured results. Do not cite them as benchmarks.

When the suite lands it will be run on commit and the results recorded here, replacing the
"design intent" wording with measured figures.
