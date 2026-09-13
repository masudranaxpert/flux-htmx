---
title: Performance
---

# Performance

## Bundle sizes (gzip, v2.1)

| File                   | gzip            | Contents                          |
| ---------------------- | --------------- | --------------------------------- |
| `flux.iife.js`         | ~19.5 kB        | core + UI plugins (htmx external) |
| `flux.js` / `flux.cjs` | ~21.7 / 19.7 kB | modular ESM / CJS                 |
| `net.iife.js`          | ~3.2 kB         | offline + upload + optimistic     |
| `flux.full.iife.js`    | ~35 kB          | everything incl. htmx 4           |

For comparison: htmx 4 alone is ~22 kB gz. The core + presets layer costs about the
same as htmx itself.

## Runtime characteristics

- **One `hidden` class** drives all visibility — no per-frame style computation.
- **Prefetch** converts hover latency into instant cache hits; keys include
  parameters, so hits are real.
- **Fragment cache** is LRU with bounded size (`fx-max-size`) — no unbounded growth.
- **Registry scans** are allocation-free and short-circuit; signatures make re-scans
  no-ops unless something changed.
- **WeakRef everywhere**: generated-attribute tracking survives manual DOM removals
  without leaking; dead refs drop lazily during iteration.

## Budget gate

CI fails on gzip budget regressions:

```bash
npm run size:check
```

Budgets live in `scripts/size.mjs`; bump them only deliberately.
