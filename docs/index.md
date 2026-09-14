---
title: flux-htmx — the request layer for HTMX 4
hide:
  - navigation
  - toc
---

# flux-htmx Documentation

## What Flux adds to htmx

| Layer                | What you get                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **Request presets**  | `fx-search`, `fx-poll`, `fx-submit`, `fx-delete`, `fx-infinite`, `fx-realtime`…             |
| **Safety**           | CSRF token injection, HTML5 validation gate, confirm dialogs — no eval, CSP-safe            |
| **Resilience**       | Automatic retry with backoff, in-flight dedupe, fragment caching                            |
| **Speed**            | Hover/touch prefetch into the cache, so the next click is instant                           |
| **Feedback**         | Built-in toasts, loading indicators, `data-flux-*` state attributes, ARIA live region       |
| **Status targeting** | `fx-on-404="#notfound"` — retarget swaps per response status code                           |
| **Visibility**       | `fx-show / fx-hide / fx-toggle / fx-class / fx-dropdown` — one `hidden` class, nothing more |

Everything is declarative `fx-*` / `hx-*` attributes processed at htmx's own pipeline
points. No build step, no virtual DOM, no client-side template language.

## Where Flux ends

Flux intentionally keeps **state on the server**. It does not provide client-side
reactivity: no two-way binding, no derived values, no client-side list rendering.
If a screen genuinely needs those — a live-validated multi-step form, an editable
table — run [Alpine.js](https://alpinejs.dev) alongside Flux. They coexist without
conflict: htmx/Flux own the requests and swaps, Alpine owns the interactive widget
state. That combination is supported, not discouraged.

## One script, any backend

```html
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
```

Works with Django, Flask, FastAPI, Go, Laravel, Rails — anything that serves HTML.
Django? Flask? Check the [examples](examples/index.md).
