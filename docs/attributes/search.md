# fx-search

Debounced, race-safe live search on an `<input>`.

```html
<input
  fx-search="/users/search"
  fx-target="#results"
  fx-delay="300ms"
  fx-min-length="2"
  fx-indicator="#loader"
  fx-search-clear="#clear-btn"
/>
```

`fx-search` expands into native HTMX attributes:

```html
<input
  hx-get="/users/search"
  hx-trigger="flux:search-ready"
  hx-sync="this:replace"
  hx-target="#results"
  hx-indicator="#loader"
/>
```

> [!NOTE]
> `fx-search` does **not** rely on HTMX's trigger filter `[...]`. It attaches a native `input` event listener that handles debouncing and min-length internally. This ensures it is 100% eval-free and works perfectly in strict Content Security Policy (CSP) environments.

The native listener skips keystrokes that leave the value unchanged. It waits `N` milliseconds after the last keystroke before dispatching a `flux:search-ready` event; each keystroke within the window resets the timer, so only the final value is requested.

`fx-delay` accepts an interval string (`300ms`, `2s`) or a bare number (interpreted as milliseconds). Default is `300ms`.

### Request replacement (`hx-sync: this:replace`)

When a new search fires while a previous request is in flight, `replace` aborts the older request. This prevents a slow response to an earlier query from overwriting the result of a later one (stale-response handling), with no custom JavaScript.

### Minimum length

`fx-min-length="N"` ensures the request only fires if the input length is at least `N` characters. An input shorter than the threshold evaluates to false and the debounce timer is not started.

### Empty query

Because the minimum-length filter trims and compares against `0` (when `fx-min-length` is omitted) or against the threshold, empty input never produces a request.

### Clear button

Use `fx-search-clear="#selector"` to wire up a clear button. When the target element is clicked, Flux will:
1. Clear the input value
2. Cancel any pending debounced requests
3. Fire an immediate empty `flux:search-ready` event (so the server can return the default/empty state)
4. Focus the input field

## Escape hatch

Any Flux preset can be replaced with the raw HTMX attributes above. Flux never prevents dropping down to plain HTMX.
