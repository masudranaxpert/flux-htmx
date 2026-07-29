# flux-htmx

> A thin, server-driven frontend layer built on top of **HTMX 4**.  
> Shorthand `fx-*` attributes, lifecycle hooks, presets, smart caching, prefetching, and built-in toasts — without reimplementing htmx.

[![npm version](https://img.shields.io/npm/v/flux-htmx.svg)](https://www.npmjs.com/package/flux-htmx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why?

HTMX is great. But writing `hx-get`, `hx-target`, `hx-trigger`, `hx-swap` for every element adds up. Flux adds a minimal preset layer on top:

```html
<!-- Without Flux -->
<a hx-get="/products" hx-target="#main" hx-trigger="click" hx-swap="innerHTML">Products</a>

<!-- With Flux -->
<a fx-get="/products" fx-target="#main">Products</a>
```

No build step required. Raw `hx-*` attributes always work as an escape hatch.

---

## Install

```bash
npm install flux-htmx
```

**Peer dependency** (required):
```bash
npm install htmx.org@4.0.0-beta6
```

---

## CDN (No Install)

### jsDelivr
```html
<!-- HTMX 4 (required first) -->
<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0-beta6/dist/htmx.iife.js"></script>

<!-- Flux (IIFE, includes htmx) -->
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@1.1.0/dist/flux.full.iife.js"></script>

<!-- CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@1.1.0/dist/flux.css">
<!-- or minified -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@1.1.0/dist/flux.min.css">
```

### unpkg
```html
<script src="https://unpkg.com/htmx.org@4.0.0-beta6/dist/htmx.iife.js"></script>
<script src="https://unpkg.com/flux-htmx@1.1.0/dist/flux.full.iife.js"></script>
<link rel="stylesheet" href="https://unpkg.com/flux-htmx@1.1.0/dist/flux.min.css">
```

> **Tip:** Use `flux.full.iife.js` for CDN (includes everything). Use `flux.iife.js` for bundlers where htmx is already imported separately.

---

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@1.0.0/dist/flux.css">
</head>
<body>
  <div id="content">
    <a fx-get="/page-2" fx-target="#content" fx-prefetch>Go to Page 2</a>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/flux-htmx@1.0.0/dist/flux.full.iife.js"></script>
  <script>
    Flux.configure({ csrf: { auto: true } });
  </script>
</body>
</html>
```

---

## Preset Attributes

| Attribute | Expands To | Description |
|---|---|---|
| `fx-get="/url"` | `hx-get` + `hx-trigger="click"` | GET request on click |
| `fx-post="/url"` | `hx-post` + `hx-trigger="click"` | POST request on click |
| `fx-delete="/url"` | `hx-delete` + confirm dialog | DELETE with confirmation |
| `fx-load="/url"` | `hx-get` + `hx-trigger="load"` | Fetch on page load |
| `fx-poll="/url"` | `hx-get` + polling trigger | Periodic polling |
| `fx-search="/url"` | `hx-get` + native debounce | Debounced search input (eval-free) |
| `fx-submit="/url"` | `hx-post` on form | Form submission |
| `fx-autosave="/url"` | `hx-post` + auto-save on input | Auto-save on change |
| `fx-infinite="/url"` | Infinite scroll | Load more on scroll |
| `fx-realtime="/url"` | `EventSource` (SSE) | Server-Sent Events stream |
| `fx-pagination="/url"` | Pagination pattern | Page-based navigation |
| `fx-prefetch` | Hover/touch prefetch | Cache on hover before click |
| `fx-history` | `hx-push-url="true"` | Push URL to browser history on swap |

---

## Modifier Attributes

| Attribute | Description |
|---|---|
| `fx-target="#id"` | Override swap target |
| `fx-swap="outerHTML"` | Override swap strategy |
| `fx-delay="300ms"` | Debounce / polling delay |
| `fx-indicator="#spinner"` | Loading indicator element |
| `fx-confirm="Sure?"` | Confirmation prompt text |
| `fx-disable` | Disable element during request |
| `fx-cache` | Cache GET response |
| `fx-toast` | Show built-in success/error toast |
| `fx-success="Done!"` | Message on success |
| `fx-error="Failed!"` | Message on error |
| `fx-validate` | Pre-submit HTML5 form validation |
| `fx-event="message"` | SSE event name (for `fx-realtime`) |

---

## Built-in Toast (`fx-toast`)

No Alpine.js required. Just add `fx-toast` to any element:

```html
<button fx-delete="/item/1"
        fx-toast
        fx-success="Deleted successfully!"
        fx-error="Failed to delete.">
  Delete
</button>
```

Toasts appear bottom-right with smooth slide-in/out animations.

---

## Prefetch (`fx-prefetch`)

Silently fetches and caches the response on `mouseenter`, `touchstart`, or `focusin` — so clicking feels instant:

```html
<a fx-get="/product/42" fx-target="#main" fx-prefetch>
  View Product
</a>
```

---

## Caching

```html
<!-- Cache this response for the default TTL -->
<section fx-load="/stats" fx-cache>...</section>

<!-- Cache with a custom key -->
<section fx-load="/stats" fx-cache fx-cache-key="stats-v1">...</section>
```

---

## JavaScript API

```js
// Configure on startup
Flux.configure({
  csrf: { auto: true, header: 'X-CSRFToken' },
  cache: { maxEntries: 100, defaultTtlMs: 60_000 },
  feedback: { indicator: '#global-spinner' },
});

// Manual cache operations
Flux.cache.invalidate('/products/*');
Flux.cache.clear();

// Diagnostics
Flux.doctor();
Flux.inspect(document.querySelector('#my-form'));

// Dispose / teardown
Flux.dispose();
```

---

## Plugin System

```js
import { uploadPlugin, optimisticPlugin } from 'flux-htmx';

Flux.configure();
Flux.use(uploadPlugin);
Flux.use(optimisticPlugin);
```

---

## ES Module (Bundler)

```js
import Flux from 'flux-htmx';

Flux.configure({ csrf: { auto: true } });
```

---

## Browser Support

All modern browsers (Chrome, Firefox, Safari, Edge). Requires `fetch` and `WeakMap` — both available natively in all target environments.

---

## License

MIT © [masudranaxpert](https://www.npmjs.com/~masudranaxpert)
