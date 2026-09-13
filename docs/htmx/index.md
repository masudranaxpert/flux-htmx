---
title: htmx 4 overview
---

# htmx 4 — the engine under Flux

flux-htmx is built on **htmx.org 4.0.0** (peer dependency `^4.0.0-beta6`, tested
against the 4.0.0 stable release). This section is a practical htmx 4 reference for
Flux users — the official source is
[four.htmx.org](https://four.htmx.org/docs).

htmx extends HTML's native hypermedia controls: **any element** can issue an HTTP
request, **any event** can trigger it, and the **response HTML can go anywhere** in
the DOM. The server returns HTML fragments — not JSON.

```html
<button hx-post="/clicked" hx-target="#output" hx-swap="outerHTML">Click Me</button>
<output id="output"></output>
```

## Pages in this section

- [Core attributes](core-attributes.md) — verbs, targets, swaps, triggers
- [Events & headers](events.md) — the 4.0 event pipeline and response headers
- [Configuration](config.md) — `htmx.config` and the meta tag
- [What's new in 4.0](whats-new-4.md) — migrating from htmx 2.x

## Install (standalone htmx)

```html
<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0"></script>
```

With Flux you usually don't write this tag — `flux.full.iife.js` **bundles htmx
4.0.0** for you:

```html
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
```

## How Flux relates to htmx

| Concern | Owner |
| --- | --- |
| `hx-get/post/put/patch/delete/query`, `hx-trigger`, `hx-target`, `hx-swap` | **htmx 4** |
| `hx-status:<code>` status targeting | **htmx 4** (Flux compiles `fx-on-404` into it) |
| Presets (`fx-search`, `fx-poll`…), verbs (`fx-get`…) | **Flux** (expand to `hx-*`) |
| CSRF, retry+backoff, dedupe, caching, prefetch, toasts | **Flux** |
| Visibility (`fx-show/hide/toggle`) | **Flux** |
