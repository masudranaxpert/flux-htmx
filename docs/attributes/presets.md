---
title: Request presets
---

# Request presets

Presets are opinionated bundles of htmx configuration behind one attribute. Each one
reads its own option attributes (see [options](options.md)) — and every raw `hx-*`
attribute still applies.

## fx-search — debounced search

```html
<input fx-search="/search" fx-target="#results" hx-trigger="input changed delay:300ms" />
```

| Option | Default | Description |
| --- | --- | --- |
| `fx-delay="300ms"` | — | Debounce window |
| `fx-min-length="3"` | — | Skip requests until N characters |
| `fx-search-clear="#clearme"` | — | Selector(s) cleared when the query empties |

## fx-poll — periodic refresh

```html
<div fx-poll="/notifications" hx-trigger="every 5s" hx-target="this"></div>
```

`fx-interval="5s"` is accepted as an alias for the trigger's `every`.

## fx-submit — form submission

```html
<form fx-submit="/users" fx-validate fx-reset fx-indicator="#save-spin">
  …
</form>
```

| Option | Description |
| --- | --- |
| `fx-validate` | Run HTML5 constraint validation first; abort silently if invalid |
| `fx-reset` | Reset the form after success |
| `fx-invalidate="/users/*"` | Clear matching cache entries after success |
| `fx-focus-error` | Focus the first invalid field on validation failure |

Full details in the [forms guide](../guides/forms.md).

## fx-delete — destructive actions

```html
<button fx-delete="/item/1" fx-confirm="Delete?" fx-toast
        fx-success="Deleted" fx-remove-target="closest tr">
  Delete
</button>
```

`fx-confirm` (native browser confirm), `fx-confirm-dialog="#id"` (your own
`<dialog>`), `fx-toast` for feedback, `fx-remove-target` for row removal.

## fx-load — on-load fetch

```html
<section fx-load="/stats" fx-target="this" fx-cache>…</section>
```

Fires on page load (and after htmx swaps that insert the element).

## fx-autosave

```html
<form fx-autosave="/draft" hx-trigger="change delay:1s">…</form>
```

Saves on change with debounce; pairs well with `fx-dirty`.

## fx-infinite — infinite scroll

```html
<div fx-infinite="/page/2" hx-target="this" hx-swap="beforeend"></div>
```

Requests the URL when the element scrolls into view and rewrites itself with the
next page link (server returns the next `fx-infinite` element).

## fx-realtime — SSE streams

```html
<div fx-realtime="/events" fx-event="ticket">…</div>
```

| Option | Description |
| --- | --- |
| `fx-event="name"` | SSE event name to listen for (defaults to `message`) |

## fx-page — pagination

```html
<nav fx-page="/items?page=2" hx-target="#list" hx-swap="afterend"></nav>
```

Reads `?page=N` from the URL and wires prev/next semantics.

## fx-prefetch

```html
<a hx-get="/product/42" hx-target="#main" fx-prefetch>View</a>
```

Fetches on hover/touch/focus into the fragment cache with the **same conventions as
real requests** (credentials, CSRF, HX-Target headers, parameters in the cache key),
so the click is a guaranteed cache hit. See [prefetch guide](../guides/prefetch.md).

## fx-history and fx-morph

```html
<a fx-get="/inbox" fx-history>…</a>   <!-- hx-push-url shorthand -->
<section fx-load="/rows" fx-morph>…</section>  <!-- hx-swap="innerMorph" -->
```
