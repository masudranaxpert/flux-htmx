---
title: Architecture
---

# Architecture

How Flux fits around htmx without fighting it.

## Expansion, not replacement

Flux's `fx-*` attributes are **expanded into htmx's native `hx-*` attributes at
processing time**. htmx's own attribute prefix stays at its default, so raw `hx-*`
remains an unconditional escape hatch: `<a fx-get="/x" hx-target="#main">` mixes
freely. Since 2.0 there is no alias layer — presets read their own option attributes
only, everything else is raw `hx-*`.

## Pipeline integration

Flux installs listeners on htmx's event pipeline — never a second network layer:

```
DOM event
  └─ htmx:config:request   → CSRF attach, timeout, credentials
  └─ htmx:before:request   → dedupe leader election, cache lookup
  └─ (network)
  └─ htmx:after:request    → retry decision, feedback state, action pipelines
  └─ htmx:after:settle     → persist restore, form dirty re-init
  └─ htmx:before:cleanup   → preset disconnects, generated-attribute release
```

Presets expand → htmx processes → Flux's registered controllers (`connect`) manage
their elements and return disconnects on cleanup.

## Ownership registry

Every `hx-*` attribute Flux writes is recorded per element (`WeakMap`) and every
touched element tracked by `WeakRef` (deduplicated, O(1)). Consequences:

- **User-written `hx-*` is never overwritten** — user takeovers are detected and
  respected.
- Removing the source `fx-*` removes Flux's generated attributes on the next pass.
- Manual DOM removal (`el.remove()`, `fx-remove`) leaves no strong references — no
  leaks on long-lived dashboards.

## Bootstrap contract

Importing any Flux entry has **no global side effects**. Entry points call
`bootstrapFlux()`, which owns the `window.Flux` slot, applies the duplicate policy and
honours `<meta name="flux-config"> autoStart`. Modular and full builds can never race
for the global.

See [decisions/0004](https://github.com/masudranaxpert/flux-htmx/blob/master/docs/decisions/0004-prefix-vs-expansion.md)
for the prefix-vs-expansion rationale.
