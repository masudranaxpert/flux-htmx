---
title: Request verbs
---

# Request verbs

`fx-get`, `fx-post`, `fx-put`, `fx-patch` and `fx-delete` turn any element into an
actionable request. They expand to htmx's native `hx-*` verbs at processing time —
so everything htmx documents about verbs applies verbatim.

```html
<a fx-get="/products" hx-target="#main">Products</a>

<button fx-post="/api/like" hx-target="find .count" hx-swap="outerHTML">Like</button>

<button fx-delete="/item/42" hx-confirm="Really delete?">Delete</button>
```

!!! tip "Mix raw hx-* freely"

    Since 2.0 the pure `fx-target` / `fx-swap` / `fx-trigger` aliases are gone on
    purpose. Write the native `hx-*` attribute next to any `fx-*` preset — htmx
    semantics, zero translation layer:

    ```html
    <a fx-get="/page/2" hx-target="#main" hx-push-url="true" hx-select="#main">Next</a>
    ```

## Trigger defaults

Without an explicit `hx-trigger`, Flux matches htmx's own defaults:

| Element | Default trigger |
| --- | --- |
| `a`, `button`, `[role=button]`, `form`-less clickable | `click` |
| `form` | `submit` |
| `input` | `change` |

Override with `hx-trigger`:

```html
<div fx-get="/stats" hx-trigger="revealed">…</div>
```

## Indicator and busy state

```html
<button fx-get="/report" fx-indicator="#spinner">Load report</button>
<img id="spinner" class="htmx-indicator" src="/spinner.svg" />
```

While in flight, the source element also receives `data-flux-loading="1"` and the
outcome attributes `data-flux-success` / `data-flux-error` after completion — style
them with plain CSS:

```css
[data-flux-loading] { opacity: 0.6; pointer-events: none; }
```

## Disable while requesting

```html
<button fx-post="/save" fx-disable>Save</button>
```

The button is disabled on request start and re-enabled on completion.

## fx-remove and fx-remove-target

`fx-remove` removes the element itself after a **duration** — useful for dismissible
notices:

```html
<div fx-remove="5s">Saved!</div>
```

To remove a different element after a successful request, use `fx-remove-target`:

```html
<button fx-delete="/item/1" fx-remove-target="closest li">Delete</button>
```

See the [events reference](../reference/events.md) for the custom events Flux dispatches
around every request.
