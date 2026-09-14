# flux-htmx

**A thin server-driven frontend layer on [htmx 4](https://htmx.org).**

Write `fx-search` instead of five `hx-*` attributes and a debounce script. Get CSRF,
retry, dedupe, caching, toasts, dirty-form guards and native `<dialog>` modals for
free. No eval, no client state, CSP-safe.

[![npm](https://img.shields.io/npm/v/flux-htmx)](https://www.npmjs.com/package/flux-htmx)
[![gzip](https://img.shields.io/badge/gzip-39%20kB%20with%20htmx-blue)](#bundles)
[![license](https://img.shields.io/npm/l/flux-htmx)](./LICENSE)

📖 **[Documentation](https://masudranaxpert.github.io/flux-htmx/)** ·
[Getting started](https://masudranaxpert.github.io/flux-htmx/getting-started/) ·
[All attributes](https://masudranaxpert.github.io/flux-htmx/attributes/presets/)

---

## Quick start

```html
<body>
  <input fx-search="/search" fx-target="#results" fx-delay="300ms" />
  <div id="results"></div>

  <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
</body>
```

That's a debounced, minimum-length, race-safe live search. htmx is bundled — one tag,
nothing to build.

Prefer npm?

```bash
npm install flux-htmx htmx.org@^4.0.0
```

---

## Why

htmx gives you the transport. Everything a real app needs _around_ the transport —
debouncing, CSRF, retries, optimistic UI, unsaved-changes guards — you write by hand,
in every project. Flux ships those as attributes.

```html
<!-- without Flux -->
<input
  hx-get="/search"
  hx-target="#results"
  hx-trigger="keyup changed delay:300ms"
  hx-sync="this:replace"
  name="q"
/>

<!-- with Flux -->
<input fx-search="/search" fx-target="#results" fx-delay="300ms" />
```

**Flux is not a client-side framework.** There is no reactive state, no `x-model`, no
template expressions. State lives on your server. If you need real client reactivity,
add [Alpine](https://masudranaxpert.github.io/flux-htmx/guides/with-alpine/) beside
it — they compose fine.

---

## What you get

**Request presets** — `fx-get` `fx-post` `fx-put` `fx-patch` `fx-delete` `fx-load`
`fx-poll` `fx-search` `fx-submit` `fx-autosave` `fx-infinite` `fx-page`
`fx-realtime` (SSE) `fx-prefetch`

**Reliability** — CSRF injection, request timeouts, exponential-backoff retry, GET
deduplication, a fragment cache with stale-while-revalidate, and an optional offline
queue.

**Feedback** — `fx-toast`, status-code targeting (`fx-on-422="#errors"`),
`data-flux-loading` / `data-flux-error` state attributes, and an ARIA live region.

**Forms** — server-driven per-field errors (`fx-field-errors`), dirty tracking with
an unsaved-changes guard, and validation gating before the request leaves.

**UI** — `<dialog>` modals and drawers honouring the standard `closedby` attribute,
dropdowns, tabs, accordions, transitions, log viewers, clipboard, relative time,
keyboard shortcuts.

**Datagrid** — `fx-sort`, shareable filter state via `fx-sync-url`, and bulk
selection with `fx-include-selection`.

**Server-driven actions** — one response header drives the client:

```
HX-Trigger: {"flux:action":"toast:Saved; close:#edit; invalidate:GET:/users*"}
```

Full reference: **[Attributes](https://masudranaxpert.github.io/flux-htmx/attributes/presets/)**

---

## A few more examples

```html
<!-- CRUD with a confirm dialog and optimistic row removal -->
<button fx-delete="/users/42" fx-confirm-dialog="#confirm" fx-remove-target="closest tr">
  Delete
</button>

<!-- Native dialog: focus trap, Escape and backdrop dismissal are handled -->
<button fx-open="#edit">Edit</button>
<dialog id="edit" fx-modal>
  <form fx-submit="/users/42" fx-dirty fx-field-errors>
    <input name="email" />
    <span data-field-error="email"></span>
  </form>
  <button fx-close>Cancel</button>
</dialog>

<!-- Live deploy log: auto-scroll, pins to bottom, caps at 500 lines -->
<div fx-realtime="/logs/stream" fx-log="500"></div>
```

---

## Bundles

| File                | Contents                                    | gzip   |
| ------------------- | ------------------------------------------- | ------ |
| `flux.full.iife.js` | htmx 4 + Flux + UI + net — **start here**   | ~39 kB |
| `flux.iife.js`      | Flux only (load htmx yourself)              | ~23 kB |
| `flux.js` / `.cjs`  | ES module / CommonJS for bundlers           | ~26 kB |
| `net.iife.js`       | Optional: offline queue, upload, optimistic | ~3 kB  |
| `flux.min.css`      | Toasts, indicators, `.hidden` — optional    | ~2 kB  |

Load `flux.css` (or define `.hidden { display: none }` yourself) — the visibility
layer depends on it.

---

## Configuration

```html
<meta name="flux-config" content='{"csrf":{"strategy":"meta"},"requests":{"timeoutMs":15000}}' />
```

```js
Flux.configure({
  csrf: { strategy: 'cookie', cookieName: 'csrftoken' },
  messages: { unsavedChanges: 'Discard unsaved changes?' },
});
```

See [Configuration](https://masudranaxpert.github.io/flux-htmx/reference/configuration/)
and the [JavaScript API](https://masudranaxpert.github.io/flux-htmx/javascript/api/).

---

## Requirements

htmx `^4.0.0-beta6` as a peer dependency. Flux targets modern evergreen browsers and
degrades gracefully where newer platform features (`closedby`, `requestClose()`) are
missing.

## Contributing

```bash
npm install
npm test          # 311 unit tests
npm run lint && npm run typecheck && npm run size:check && npm run docs:coverage
```

Every `fx-*` attribute in `src/` must be documented before it can merge — CI enforces it.

Upgrading from 1.x? See the
[migration guide](https://masudranaxpert.github.io/flux-htmx/migration/from-1x/).

## License

MIT © [masudranaxpert](https://github.com/masudranaxpert)
