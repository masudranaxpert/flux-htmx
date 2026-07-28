# fx-search

Debounced, race-safe live search on an `<input>`.

```html
<input
  fx-search="/users/search"
  fx-target="#results"
  fx-delay="300ms"
  fx-min-length="2"
  fx-indicator="#loader"
/>
```

## Expansion

`fx-search` expands into native HTMX attributes:

```html
<input
  hx-get="/users/search"
  hx-trigger="input changed delay:300ms[event.target.value.trim().length >= 2]"
  hx-sync="this:replace"
  hx-target="#results"
  hx-indicator="#loader"
/>
```

### Debounce

`changed` skips keystrokes that leave the value unchanged. `delay:Nms` waits `N` milliseconds after the last keystroke before issuing a request; each keystroke within the window resets the timer, so only the final value is requested.

`fx-delay` accepts an interval string (`300ms`, `2s`) or a bare number (interpreted as milliseconds). Default is `300ms`.

### Request replacement (`hx-sync: this:replace`)

When a new search fires while a previous request is in flight, `replace` aborts the older request. This prevents a slow response to an earlier query from overwriting the result of a later one (stale-response handling), with no custom JavaScript.

### Minimum length

`fx-min-length` becomes a trigger filter (`event.target.value.trim().length >= N`). An input shorter than the threshold, or empty, evaluates the filter to false and no request is issued.

### Empty query

Because the minimum-length filter trims and compares against `0` (when `fx-min-length` is omitted) or against the threshold, empty input never produces a request.

## CSP limitation

The trigger filter (`[...]`) requires HTMX's eval support (`htmx.config.allowEval`). Under a strict CSP that disallows `eval`, drop `fx-min-length` and handle minimum-length filtering on the server, or fall back to a hand-written `hx-trigger` (see [the raw HTMX escape hatch](#escape-hatch)).

## Escape hatch

Any Flux preset can be replaced with the raw HTMX attributes above. Flux never prevents dropping down to plain HTMX.
