# flux-htmx

> The request layer for **HTMX 4** — presets, retries, caching, prefetch, CSRF and toasts
> in one thin script. Includes a small eval-free visibility layer so a show/hide toggle
> doesn't cost a second library. Raw `hx-*` attributes stay first-class throughout.

[![npm version](https://img.shields.io/npm/v/flux-htmx.svg)](https://www.npmjs.com/package/flux-htmx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What Flux is

htmx gives you `hx-get`, `hx-post` and a swap pipeline. Flux layers the things real
server-driven apps need on every page:

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
points. There is no build step, no virtual DOM, and no client-side template language.

### Where Flux ends

Flux intentionally keeps **state on the server**. It does not provide client-side
reactivity: no two-way binding (`x-model`), no derived/computed values, no client-side
list rendering, no scoped stores. If a screen genuinely needs those — a live-validated
multi-step form, an editable table, heavy client state — run **Alpine.js alongside
Flux**. They coexist without conflict: htmx/Flux own the requests and swaps, Alpine owns
the interactive widget state. That combination is supported, not discouraged.

```html
<!-- Flux: the request, cached, with a toast -->
<form fx-submit="/subscribe" fx-cache="0" fx-toast fx-success="Subscribed!">...</form>

<!-- Alpine, alongside: pure client-side widget state -->
<div x-data="{ step: 1 }">...</div>
```

> **2.0 note:** the pure `fx-*` → `hx-*` option aliases (`fx-target`, `fx-swap`,
> `fx-trigger`, …) were removed — write the native `hx-*` attribute directly. Presets
> still read their own option attributes (`fx-target`, `fx-swap`, `fx-delay`,
> `fx-indicator`, …) next to a preset like `fx-search` or `fx-delete`.

---

## Install

```bash
npm install flux-htmx
npm install htmx.org@^4.0.0   # peer dependency for the core builds
```

## CDN (No Install)

### jsDelivr

```html
<!-- Standalone Flux bundle (includes HTMX 4, UI plugins, net extras) -->
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>

<!-- CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.css" />
<!-- or minified -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.min.css" />
```

### unpkg

```html
<script src="https://unpkg.com/flux-htmx@2/dist/flux.full.iife.js"></script>
<link rel="stylesheet" href="https://unpkg.com/flux-htmx@2/dist/flux.min.css" />
```

### Bundles

| File                   | Contents                                             | Size (gzip) |
| ---------------------- | ---------------------------------------------------- | ----------- |
| `flux.full.iife.js`    | htmx 4 + core + UI plugins + net extras              | ~35 kB      |
| `flux.iife.js`         | core + UI plugins, htmx from `globalThis.htmx`       | ~20 kB      |
| `net.iife.js`          | offline queue + upload/optimistic plugins (optional) | ~3 kB       |
| `flux.js` / `flux.cjs` | modular ESM / CJS, htmx.org as peer dependency       | ~20–22 kB   |

Loading the full bundle after the modular bundle is not supported — the duplicate-load
policy reuses the first `window.Flux` it sees.

---

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My App</title>
    <meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.css" />
  </head>
  <body>
    <div id="content">
      <a hx-get="/page-2" hx-target="#content" fx-prefetch>Go to Page 2</a>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
  </body>
</html>
```

Put the script at the end of `<body>`. If it ends up in `<head>`, Flux still boots —
plugins wait for the DOM instead of crashing.

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

Generic request attributes (`hx-trigger`, `hx-select`, `hx-sync`, `hx-include`,
`hx-vals`, `hx-headers`, `hx-boost`, `hx-preserve`, …) come straight from htmx — mix
them freely next to any `fx-*` preset.

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

## Prefetch (`fx-prefetch`)

Silently fetches and caches the response on `mouseenter`, `touchstart`, or `focusin`.
Prefetch goes through the same conventions as real requests — credentials, CSRF token,
`HX-Target`/`HX-Trigger`/`HX-Current-URL` headers, timeout, and the same cache key
including parameters — so a prefetched entry is always a real cache hit.

```html
<a hx-get="/product/42" hx-target="#main" fx-prefetch> View Product </a>
```

---

## Visibility Layer

A small, honest set of show/hide primitives so a toggle doesn't require pulling in a
separate library. All actions are declarative, eval-free, CSP-compliant, and default to
`click`. Every visibility action drives **one mechanism: the `hidden` class** —
synchronous, Tailwind-compatible, and composable (a panel hidden by `fx-hide` is shown
again by `fx-show` or `fx-toggle`; no inline-style fights).

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

`fx-dropdown` toggles the target's `hidden` class and coordinates outside-click and
`Escape` close in one handler — so the click that opens a menu can never immediately
close it. The trigger's `aria-expanded` stays in sync.

```html
<button fx-dropdown="#menu">Toggle</button>

<ul id="menu" class="hidden">
  <li><a href="/profile">Profile</a></li>
  <li><a href="/settings">Settings</a></li>
</ul>
```

### Modals — canonical path: `<dialog>` + fx-open/fx-close

```html
<button fx-open="#edit">Edit</button>

<dialog id="edit" fx-modal>
  <form method="dialog">...</form>
  <button fx-close>Cancel</button>
</dialog>
```

`fx-modal` closes the dialog on backdrop click. Focus handling and restoration are
built in. The old div-based pattern (`fx-show` + `fx-hide-outside` + `fx-hide-escape`)
still works — treat it as legacy for when you cannot use `<dialog>`.

**CSS requirement:** the visibility layer drives one `.hidden` class. Without
Tailwind, load `flux.css` (or add `.hidden{display:none}` yourself) — `flux.css`
defines it for you.

### Inline DOM helpers (Surreal-style)

For one-off logic inside an element, `me()` (the script's parent) and `any()` (global
selector) give thin wrappers over the native DOM — true Locality of Behavior:

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

Available methods: `classAdd()`, `classRemove()`, `classToggle()`, `styles()`, `on()`,
`off()`, `attribute()`, `disable()`, `enable()`, `fadeOut()`, `fadeIn()`, `remove()` —
each a direct delegate of the corresponding native API.

---

## Caching

```html
<!-- Cache this response for the default TTL -->
<section fx-load="/stats" fx-cache>...</section>

<!-- Cache with a custom key -->
<section fx-load="/stats" fx-cache fx-cache-key="stats-v1">...</section>
```

Cache keys hash sensitive parameter values (passwords, tokens, …) instead of dropping
them — two requests differing only in a secret get distinct entries, and the secret
itself never appears in the key.

---

## Server-driven actions (HX-Trigger)

The server can run any client pipeline through htmx's own `HX-Trigger` header —
one header closes modals, refreshes tables, invalidates caches and toasts:

```go
w.Header().Set("HX-Trigger",
  `{"flux:action":"toast:Saved; close:#edit; invalidate:GET:/containers*"}`)
```

Built-in server-callable actions: `toast`, `close`, `open`, `reset`, `refresh`,
`remove`, `invalidate` (cache wildcard) — plus anything registered via
`Flux.registerAction()`.

## Datagrid: sort, sync-url, bulk selection

```html
<table fx-sort-url="/containers" hx-target="tbody">
  <thead>
    <tr>
      <th fx-sort="name">Name</th>
    </tr>
  </thead>
  …
</table>

<form fx-search="/containers" fx-target="#rows" fx-sync-url>…</form>
<button fx-post="/containers/stop" fx-include-selection="#table">Stop selected</button>
```

- `fx-sort` on `<th>`: click cycles asc → desc → none, appends `?sort=&dir=` to the
  request, keeps `aria-sort` in sync.
- `fx-sync-url` on a filter form: state lives in the address bar — shareable links,
  refresh-safe, back/forward re-requests.
- `fx-include-selection="#id"` on a button: sends checked `input[fx-select]` values
  as parameters; disables the button when nothing is selected.

## Field validation errors from the server

```html
<form fx-submit="/users" fx-field-errors>
  <input name="email" /><span data-field-error="email"></span>
</form>
```

Server returns `422` with `{"email": "already taken"}` → Flux fills the slots, marks
inputs `aria-invalid`, focuses the first invalid field, clears on next edit.

## Reliability extras

- **`fx-poll` pauses when the tab is hidden** and fires once on return — no wasted
  server load from abandoned admin tabs.
- **`fx-idempotency-key`** on a form/button: attaches a stable `Idempotency-Key`
  header reused across retries, so a double-clicked "Deploy" cannot create two
  containers.

## Offline Queue, Upload & Optimistic UI (optional `net` entry)

These ship separately so core users don't download them:

- **CDN:** load `dist/net.iife.js` after the core bundle (exposes `FluxNet`).
- **Bundler:** `import { installNet, uploadPlugin, optimisticPlugin, offline } from 'flux-htmx/net'`.

The full CDN bundle (`flux.full.iife.js`) already includes everything.

`fx-offline` is opt-in and experimental. It stores plain request parameters in
`localStorage`; it does not preserve files/FormData, headers, target/swap metadata,
expiry, or sensitive-field filtering. Do not use it for sensitive or file-bearing
requests.

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

## Plugin System

```js
// Bundler
import { uploadPlugin, optimisticPlugin } from 'flux-htmx/net';

Flux.use(uploadPlugin);
Flux.use(optimisticPlugin);
Flux.unuse('upload');
```

Every UI plugin installer (`installTabs()`, `installPersist()`, …) returns a teardown
function, and `Flux.dispose()` runs it — dispose → start cycles never stack listeners
or observers.

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

## What's New in v2.1

- **Clean teardown contract** — every UI plugin installer returns a teardown; `Flux.dispose()` removes plugin listeners and MutationObservers, so dispose → start cycles can no longer stack them. `installTransitions()` no longer crashes when the script runs before `<body>` exists.
- **Safer internals** — retry never falls back to re-clicking the element (no surprise `hx-confirm` replays); cache keys hash sensitive values instead of dropping them (distinct cache entries per secret, secrets never appear in keys); sugar helpers are thin native delegates (`offAll` node-cloning removed); generated-attribute registry is deduplicated and O(1).
- **Less weight** — dead code cut (undocumented CLI, recipe system, named action pipelines); core gzip dropped ~0.5 kB. CI now fails on bundle-size budget regressions (`npm run size:check`).

## What's New in v2.0

- **Reliable bootstrap contract** — importing the module has zero global side effects; `bootstrapFlux()` publishes `window.Flux` and auto-starts. The CDN bundles call it for you (fixes UI plugins not installing in 1.x full bundles).
- **20+ runtime bug fixes** — visibility/listener lifecycle, dedupe deadlocks, retry header loss, invalid-form confirm bypass, prefetch pipeline parity, memory-leak sweeps, optimistic rollback defaults.
- **Real CommonJS build** — `require('flux-htmx')` now works (`dist/flux.cjs`).
- **Optional `net` entry** — offline queue, upload and optimistic plugins moved out of core so everyone else ships less.
- **Leaner API** — the pure `fx-*` → `hx-*` alias layer is gone. Write the native htmx attribute directly; presets still read their own option attributes (`fx-target`, `fx-swap`, `fx-delay`, `fx-indicator`, …).

### Migrating from 1.x

| 1.x                                          | 2.0                                                     |
| -------------------------------------------- | ------------------------------------------------------- |
| `<a fx-get="/x" fx-target="#main">`          | `<a fx-get="/x" hx-target="#main">` (all pure aliases)  |
| `fx-delete` + `fx-remove="closest li"`       | `fx-delete` + `fx-remove-target="closest li"`           |
| `fx-remove="3s"`                             | unchanged — `fx-remove` is duration-only self-removal   |
| offline/upload/optimistic bundled in core    | `import … from 'flux-htmx/net'` or load `net.iife.js`   |
| optimistic rollback opt-in via `fx-rollback` | rollback on failure is the default                      |
| `window.Flux` set at import time (ESM)       | call `bootstrapFlux()` (CDN bundles boot automatically) |

---

## Development

```bash
npm run build        # all bundles + CSS + type declarations
npm test             # unit suite (vitest, jsdom)
npm run test:browser # Playwright e2e (Chromium)
npm run size         # honest bundle-size report
npm run size:check   # same report, fails CI on gzip budget regression
```

---

MIT © [masudranaxpert](https://www.npmjs.com/~masudranaxpert)
