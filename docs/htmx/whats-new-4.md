---
title: What's new in htmx 4
---

# What's new in htmx 4

The three behavioural changes when coming from htmx 2.x, per the
[official docs](https://four.htmx.org/docs):

## 1. Explicit inheritance

2.x inherited `hx-*` attributes implicitly down the DOM; 4.0 requires explicit
`hx-inherit`. Restore old behaviour with `htmx.config.implicitInheritance = true`.

```html
<div hx-get="/x" hx-inherit="true">
  <button hx-get="/y"><!-- inherits nothing by default in 4.0 --></button>
</div>
```

## 2. Error responses swap

4xx/5xx responses **now swap into the DOM by default** (2.x ignored them). This is
what makes Flux's `fx-on-<code>` status targeting natural:

```html
<form fx-submit="/login" fx-on-401="#prompt" fx-on-422="#errors">…</form>
```

Restore 2.x behaviour: `htmx.config.noSwap = [204, 304, '4xx', '5xx']`.

## 3. History via the server

4.0 restores history navigation by **requesting the full page from the server**
instead of replaying a local snapshot. Prefer the `hx-history-cache` extension if you
want local caching.

## Also new

- `hx-query` (HTTP `QUERY`) and `hx-action` / `hx-method` form-style requests
- Standardized, rationalized event names (single name per event)
- Native `hx-status:<code>` targeting — the foundation of Flux status targeting
- `npx htmx.org@4.0.0 upgrade-check -- ./project` — scans templates for 2.x patterns
- [`htmax.js`](https://four.htmx.org/docs/htmax) — htmx bundled with the core extensions

## Version policy in flux-htmx

- flux-htmx `2.1.x` ships and tests against **htmx.org 4.0.0**.
- Peer dependency range: `^4.0.0-beta6` — any htmx 4.0 pre-release or stable works;
  stable 4.0.0 is what CI exercises (271 unit tests + Playwright suite).
- htmx stays a **peer dependency** for modular builds; the CDN full bundle pins its
  bundled copy.
