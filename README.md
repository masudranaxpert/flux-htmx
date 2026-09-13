# flux-htmx

> A thin, server-driven frontend layer built on top of **HTMX 4**.  
> Shorthand `fx-*` attributes, presets, lifecycle hooks, smart caching, prefetching, and built-in toasts — without reimplementing htmx.

[![npm version](https://img.shields.io/npm/v/flux-htmx.svg)](https://www.npmjs.com/package/flux-htmx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why?

Flux adds a preset layer on top of htmx: request presets (`fx-search`, `fx-poll`, `fx-submit`…), UI behaviour (`fx-dropdown`, `fx-toggle`…), caching, retry/dedupe, and toasts — while raw `hx-*` attributes remain the unconditional escape hatch.

```html
<!-- Flux verb + native htmx configuration -->
<a hx-get="/products" hx-target="#main">Products</a>

<!-- Flux preset: debounced search without eval -->
<input fx-search="/search" fx-target="#results" fx-delay="300ms" />
```

No build step required.

> **2.0 note:** the pure `fx-*` → `hx-*` option aliases (`fx-target`, `fx-swap`, `fx-trigger`, `fx-select`, `fx-sync`, `fx-include`, `fx-vals`, `fx-headers`, `fx-confirm`, `fx-boost`, `fx-preload`, `fx-preserve`) were removed — write the `hx-*` attribute directly. Presets still read their own option attributes (`fx-target`, `fx-swap`, `fx-delay`, `fx-indicator`, …) next to a preset like `fx-search` or `fx-delete`.

---

## Install

```bash
npm install flux-htmx
```

**Peer dependency** (required for the core builds):

```bash
npm install htmx.org@^4.0.0-beta6
```

---

## CDN (No Install)

### jsDelivr

```html
<!-- Standalone Flux bundle (includes HTMX 4, UI plugins, net extras) -->
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2.0.0/dist/flux.full.iife.js"></script>

<!-- CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2.0.0/dist/flux.css" />
<!-- or minified -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2.0.0/dist/flux.min.css" />
```

### unpkg

```html
<script src="https://unpkg.com/flux-htmx@2.0.0/dist/flux.full.iife.js"></script>
<link rel="stylesheet" href="https://unpkg.com/flux-htmx@2.0.0/dist/flux.min.css" />
```

### Bundles

| File                   | Contents                                             | Size (gzip) |
| ---------------------- | ---------------------------------------------------- | ----------- |
| `flux.full.iife.js`    | htmx 4 + core + UI plugins + net extras              | ~35 kB      |
| `flux.iife.js`         | core + UI plugins, htmx from `globalThis.htmx`       | ~20 kB      |
| `net.iife.js`          | offline queue + upload/optimistic plugins (optional) | ~3 kB       |
| `flux.js` / `flux.cjs` | modular ESM / CJS, htmx.org as peer dependency       | ~20 kB      |

Loading the full bundle after the modular bundle is not supported — the duplicate-load policy reuses the first `window.Flux` it sees.

---

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My App</title>
    <meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2.0.0/dist/flux.css" />
  </head>
  <body>
    <div id="content">
      <a hx-get="/page-2" hx-target="#content" fx-prefetch>Go to Page 2</a>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2.0.0/dist/flux.full.iife.js"></script>
  </body>
</html>
```

---

## Request Presets

| Attribute            | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `fx-get="/url"`      | GET request on click (`fx-post` / `fx-put` / `fx-patch` likewise)   |
| `fx-delete="/url"`   | DELETE request; add `fx-confirm` or `fx-confirm-dialog` when needed |
| `fx-load="/url"`     | Fetch on page load                                                  |
| `fx-poll="/url"`     | Periodic polling                                                    |
| `fx-search="/url"`   | Debounced search input (eval-free)                                  |
| `fx-submit="/url"`   | Form submission                                                     |
| `fx-autosave="/url"` | Auto-save on change                                                 |
| `fx-infinite="/url"` | Infinite scroll                                                     |
| `fx-realtime="/url"` | `EventSource` (SSE) stream                                          |
| `fx-page="/url"`     | Pagination pattern                                                  |
| `fx-prefetch`        | Hover/touch prefetch into the cache                                 |
| `fx-history`         | `hx-push-url` shorthand                                             |
| `fx-morph`           | `hx-swap="innerMorph"` shorthand                                    |

### Preset options

Presets read these attributes themselves (they are not global aliases):
`fx-target`, `fx-swap`, `fx-delay`, `fx-interval`, `fx-min-length`, `fx-indicator`,
`fx-confirm`, `fx-disable`, `fx-success`, `fx-error`, `fx-invalidate`, `fx-reset`,
`fx-append`, `fx-prepend`, `fx-search-clear`, `fx-event`, `fx-with-credentials`,
`fx-remove-target`, `fx-cache`, `fx-cache-mode`, `fx-cache-key`, `fx-cache-vary`,
`fx-max-size`, `fx-allowed-types`.

Generic request attributes (`hx-trigger`, `hx-select`, `hx-sync`, `hx-include`, `hx-vals`, `hx-headers`, `hx-boost`, `hx-preserve`, …) come straight from htmx.

---

## Modifier Attributes

| Attribute                 | Description                        |
| ------------------------- | ---------------------------------- |
| `fx-delay="300ms"`        | Debounce / polling delay           |
| `fx-indicator="#spinner"` | Loading indicator element          |
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
  fx-remove-target="closest li"
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

Silently fetches and caches the response on `mouseenter`, `touchstart`, or `focusin` — so clicking feels instant. Prefetch goes through the same conventions as real requests (credentials, CSRF token, `HX-Target`/`HX-Trigger`/`HX-Current-URL` headers, and the same cache key including parameters):

```html
<a hx-get="/product/42" hx-target="#main" fx-prefetch> View Product </a>
```

---

## DOM Interactivity

Flux covers the class-toggling and show/hide core of what Alpine.js is used for in server-rendered panels: declarative `fx-*` action attributes, no `eval()`, 100% CSP compliant. All actions default to triggering on `click`.

All visibility actions drive **one mechanism: the `hidden` class** — synchronous, Tailwind-compatible, and composable (a panel hidden by `fx-hide` is shown again by `fx-show` or `fx-toggle`). For reactive client-side state (scoped stores, two-way binding, list rendering), Alpine remains the right tool; Flux intentionally keeps state on the server.

```html
<!-- Shows #sidebar on click (removes .hidden) -->
<button fx-show="#sidebar">Open</button>

<!-- Hides #sidebar on click (adds .hidden) -->
<button fx-hide="#sidebar">Close</button>

<!-- Toggles .hidden on click -->
<button fx-toggle="#sidebar">Toggle Menu</button>

<!-- Toggles a class on click (targets self by default) -->
<div fx-class="bg-blue-500">Toggle My Color</div>

<!-- Toggles a class on a specific target -->
<button fx-class="translate-x-full" fx-target=".circle">Toggle Circle</button>

<!-- Removes ITSELF after 3 seconds (value must be a duration) -->
<div fx-remove="3s">Item Saved Successfully!</div>
```

### Dropdowns

`fx-dropdown` toggles the target's `hidden` class and coordinates outside-click and `Escape` close in one handler — so the click that opens a menu can never immediately close it:

```html
<button fx-dropdown="#menu">Toggle</button>

<ul id="menu" class="hidden">
  <li><a href="/profile">Profile</a></li>
  <li><a href="/settings">Settings</a></li>
</ul>
```

`fx-dropdown` keeps the trigger's `aria-expanded` in sync. Clicking the trigger toggles; clicking outside the trigger or menu, or pressing `Escape`, closes it.

### Modals

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

If you need custom logic, Flux provides lightweight DOM wrappers `me()` (the script's parent element) and `any()` (global selector) for true Locality of Behavior:

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

## Experimental Offline Queue & Upload/Optimistic Plugins

These features ship in the **optional net entry** so core users don't download them:

- **CDN:** load `dist/net.iife.js` after the core bundle (exposes `FluxNet`).
- **Bundler:** `import { installNet, uploadPlugin, optimisticPlugin, offline } from 'flux-htmx/net'`.

The full CDN bundle (`flux.full.iife.js`) already includes everything.

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
// Bundler
import { uploadPlugin, optimisticPlugin } from 'flux-htmx/net';

Flux.use(uploadPlugin);
Flux.use(optimisticPlugin);
Flux.unuse('upload');
```

---

## ES Module (Bundler)

```js
import Flux from 'flux-htmx';

Flux.reconfigure({ csrf: { strategy: 'meta' } });
// or explicit bootstrap (publishes window.Flux and honours meta-tag autoStart):
import { bootstrapFlux } from 'flux-htmx';
bootstrapFlux();
```

Importing the module has **no global side effects** — the CDN/IIFE builds call
`bootstrapFlux()` for you; modular consumers opt in.

---

## Development

```bash
npm run build        # all bundles + CSS + type declarations
npm test             # unit suite (vitest, jsdom)
npm run test:browser # Playwright e2e (Chromium)
npm run size         # honest bundle-size report
```

---

MIT © [masudranaxpert](https://www.npmjs.com/~masudranaxpert)
