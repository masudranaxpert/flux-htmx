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

**Peer dependency** (required for the core builds):

```bash
npm install htmx.org@4.0.0-beta6
```

---

## CDN (No Install)

### jsDelivr

```html
<!-- Standalone Flux bundle (includes HTMX 4) -->
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@1.2.6/dist/flux.full.iife.js"></script>

<!-- CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@1.2.6/dist/flux.css" />
<!-- or minified -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@1.2.6/dist/flux.min.css" />
```

### unpkg

```html
<script src="https://unpkg.com/flux-htmx@1.2.6/dist/flux.full.iife.js"></script>
<link rel="stylesheet" href="https://unpkg.com/flux-htmx@1.2.6/dist/flux.min.css" />
```

> **Tip:** Use `flux.full.iife.js` for CDN (includes everything). Use `flux.iife.js` for bundlers where htmx is already imported separately.

---

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My App</title>
    <meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@1.2.6/dist/flux.css" />
  </head>
  <body>
    <div id="content">
      <a fx-get="/page-2" fx-target="#content" fx-prefetch>Go to Page 2</a>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@1.2.6/dist/flux.full.iife.js"></script>
  </body>
</html>
```

---

## Preset Attributes

| Attribute            | Expands To                       | Description                                                         |
| -------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `fx-get="/url"`      | `hx-get` + `hx-trigger="click"`  | GET request on click                                                |
| `fx-post="/url"`     | `hx-post` + `hx-trigger="click"` | POST request on click                                               |
| `fx-delete="/url"`   | `hx-delete`                      | DELETE request; add `fx-confirm` or `fx-confirm-dialog` when needed |
| `fx-load="/url"`     | `hx-get` + `hx-trigger="load"`   | Fetch on page load                                                  |
| `fx-poll="/url"`     | `hx-get` + polling trigger       | Periodic polling                                                    |
| `fx-search="/url"`   | `hx-get` + native debounce       | Debounced search input (eval-free)                                  |
| `fx-submit="/url"`   | `hx-post` on form                | Form submission                                                     |
| `fx-autosave="/url"` | `hx-post` + auto-save on input   | Auto-save on change                                                 |
| `fx-infinite="/url"` | Infinite scroll                  | Load more on scroll                                                 |
| `fx-realtime="/url"` | `EventSource` (SSE)              | Server-Sent Events stream                                           |
| `fx-page="/url"`     | Pagination pattern               | Page-based navigation                                               |
| `fx-prefetch`        | Hover/touch prefetch             | Cache on hover before click                                         |
| `fx-history`         | `hx-push-url="true"`             | Push URL to browser history on swap                                 |

---

## Modifier Attributes

| Attribute                 | Description                        |
| ------------------------- | ---------------------------------- |
| `fx-target="#id"`         | Override swap target               |
| `fx-swap="outerHTML"`     | Override swap strategy             |
| `fx-delay="300ms"`        | Debounce / polling delay           |
| `fx-indicator="#spinner"` | Loading indicator element          |
| `fx-confirm="Sure?"`      | Confirmation prompt text           |
| `fx-disable`              | Disable element during request     |
| `fx-cache`                | Cache GET response                 |
| `fx-toast`                | Show built-in success/error toast  |
| `fx-success="Done!"`      | Message on success                 |
| `fx-error="Failed!"`      | Message on error                   |
| `fx-validate`             | Pre-submit HTML5 form validation   |
| `fx-event="message"`      | SSE event name (for `fx-realtime`) |

---

## Built-in Toast (`fx-toast`)

Add `fx-toast` to any element:

```html
<button
  fx-delete="/item/1"
  fx-toast
  fx-success="Deleted successfully!"
  fx-error="Failed to delete."
>
  Delete
</button>
```

Toasts appear bottom-right with smooth slide-in/out animations.

---

## Prefetch (`fx-prefetch`)

Silently fetches and caches the response on `mouseenter`, `touchstart`, or `focusin` — so clicking feels instant:

```html
<a fx-get="/product/42" fx-target="#main" fx-prefetch> View Product </a>
```

---

## DOM Interactivity (Alpine Alternative)

Flux completely eliminates the need for Alpine.js or inline JavaScript for common UI interactivity like toggling sidebars, modals, or classes. It provides declarative `fx-*` action attributes that run entirely client-side without `eval()`, making them 100% CSP compliant and blazing fast.

### Declarative UI Actions

No `<script>` tags required. All actions default to triggering on `click`.

```html
<!-- Fades in #sidebar on click -->
<button fx-show="#sidebar">Open</button>

<!-- Fades out #sidebar on click -->
<button fx-hide="#sidebar">Close</button>

<!-- Toggles visibility on click -->
<button fx-toggle="#sidebar">Toggle Menu</button>

<!-- Toggles a class on click (targets self by default) -->
<div fx-class="bg-blue-500">Toggle My Color</div>

<!-- Toggles a class on a specific target -->
<button fx-class="translate-x-full" fx-target=".circle">Toggle Circle</button>

<!-- Fades out and removes ITSELF after 3 seconds -->
<div fx-remove="3s">Item Saved Successfully!</div>
```

### Modals & Dropdowns

Modals and dropdowns often need to close when you click outside of them or press the `Escape` key. Flux has built-in primitives for this:

```html
<button fx-show="#my-modal">Open Modal</button>

<div id="my-modal" class="hidden">
  <!-- Close when clicking outside this specific content box -->
  <div class="modal-content" fx-hide-outside="#my-modal" fx-hide-escape="#my-modal">
    <h2>Hello Modal</h2>
    <button fx-hide="#my-modal">Close</button>
  </div>
</div>
```

### Advanced DOM Scripts (Surreal-style)

If you need custom logic, Flux provides lightweight DOM wrappers `me()` (the script's parent element) and `any()` (global selector) for true Locality of Behavior.

```html
<button>
  Toggle Menu
  <script>
    me().on('click', () => {
      any('#menu').classToggle('hidden');
      me().classToggle('active');
    });
  </script>
</button>
```

Available methods on selected elements:
`classAdd()`, `classRemove()`, `classToggle()`, `styles()`, `on()`, `off()`, `attribute()`, `disable()`, `enable()`, `fadeOut()`, `fadeIn()`, `remove()`.

---

## Caching

```html
<!-- Cache this response for the default TTL -->
<section fx-load="/stats" fx-cache>...</section>

<!-- Cache with a custom key -->
<section fx-load="/stats" fx-cache fx-cache-key="stats-v1">...</section>
```

---

## Experimental Offline Queue

`fx-offline` is opt-in and experimental. It stores plain request parameters in
`localStorage`; it does not preserve files/FormData, headers, target/swap metadata, expiry, or
sensitive-field filtering. Do not use it for sensitive or file-bearing requests.

---

## JavaScript API

```js
// Restart with runtime configuration
Flux.reconfigure({
  csrf: { strategy: 'meta', headerName: 'X-CSRFToken' },
  requests: { timeoutMs: 15_000 },
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

Flux.use(uploadPlugin);
Flux.use(optimisticPlugin);
Flux.unuse('upload');
```

---

## ES Module (Bundler)

```js
import Flux from 'flux-htmx';

Flux.reconfigure({ csrf: { strategy: 'meta' } });
```

---

## Browser Support

All modern browsers (Chrome, Firefox, Safari, Edge). Requires `fetch` and `WeakMap` — both available natively in all target environments.

---

## License

MIT © [masudranaxpert](https://www.npmjs.com/~masudranaxpert)
