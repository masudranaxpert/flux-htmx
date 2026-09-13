---
title: Status targeting
---

# Status targeting

Server-driven apps often want a **different target per HTTP status**: a 401 should
open the login prompt, a 422 should render validation errors, a 404 should show a
"not found" panel — all from the same request.

```html
<form fx-submit="/login" fx-on-401="#login-prompt" fx-on-422="#errors">…</form>
```

`fx-on-<code>="selector"` compiles to native HTMX 4 status targeting
(`hx-status:<code>`) — one canonical attribute per code, processed by htmx itself:

```html
<form
  fx-submit="/login"
  hx-status:401='{"target":"#login-prompt"}'
  hx-status:422='{"target":"#errors"}'
></form>
```

## How it behaves

- **Signature tracking**: each element keeps a `data-flux-status-signature`. Re-scans
  are no-ops unless the set of `fx-on-*` rules changed.
- **Stale rules are cleaned**: removing an `fx-on-404` attribute removes the
  generated `hx-status:404` on the next pass.
- **Dynamic content**: every htmx `before:process` (including swaps) wires new
  elements; the scan is allocation-free.
- **Compose with actions**: combine with `fx-on-success` /
  `fx-on-error` pipelines for imperative side effects:

```html
<form fx-submit="/login" fx-on-401="#login-prompt" fx-on-error="toast:Login failed"></form>
```

## Doctor integration

`Flux.doctor()` and `Flux.inspect(element)` report status rules per element, so
mis-spelled codes (`fx-on-4O4`) are visible during development.
