---
title: Toasts & feedback
---

# Toasts & feedback

## Built-in toasts

```html
<button fx-delete="/item/1" fx-toast fx-success="Deleted!" fx-error="Failed.">Delete</button>
```

`fx-toast` shows a slide-in toast bottom-right on completion. `fx-success` and
`fx-error` override the messages; with `fx-error` alone, only errors toast.

Toasts are also triggerable from action pipelines and programmatically:

```html
<form fx-submit="/users" fx-on-error="toast:Something went wrong">…</form>
```

## Loading and outcome attributes

Every request source gets state attributes you can style with plain CSS:

| Attribute                       | When                       |
| ------------------------------- | -------------------------- |
| `data-flux-loading="1"`         | Request in flight          |
| `data-flux-success="1"`         | Last request succeeded     |
| `data-flux-error="1"`           | Last request failed        |
| `data-flux-http-error="<code>"` | Failed with an HTTP status |
| `data-flux-network-error="1"`   | Failed without a response  |
| `data-flux-timeout="1"`         | Timed out                  |

```css
[data-flux-loading] {
  opacity: 0.6;
  pointer-events: none;
}
[data-flux-error] {
  border-color: #dc2626;
}
```

New requests clear the previous outcome first — no stale error borders.

## Global indicator

```html
<meta name="flux-config" content='{"feedback":{"indicator":"#busy"}}' />
<div id="busy" class="htmx-indicator">Working…</div>
```

## ARIA live region

Flux maintains an `aria-live="polite"` region and announces success/error messages
from `fx-success` / `fx-error` for screen readers.
