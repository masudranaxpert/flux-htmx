# Architecture

Flux is a thin layer over [HTMX 4](https://htmx.org). It does not reimplement HTMX; it expands Flux shorthand attributes into HTMX attributes, and HTMX does the rest.

## Attribute model & Ownership Registry

Flux keeps two namespaces strictly separated:

```
fx-*  = Flux shorthand and presets (source of truth, written by the developer)
hx-*  = raw HTMX escape hatch (always available, always authoritative)
```

At processing time Flux copies `fx-*` onto the corresponding `hx-*` attributes. **Raw `hx-*` always wins**: if an element already declares `hx-get`, Flux never overwrites it. This makes the escape hatch unconditional — developers can mix `fx-*` and `hx-*` on the same element or use raw HTMX exclusively.

### Central Generated Attribute Registry

All generated `hx-*` attributes written by Flux are tracked in a central `generatedAttributes` registry. This provides clear ownership semantics:

- **Raw User Preservation**: User-written `hx-*` attributes are never modified or claimed.
- **User Takeover Detection**: If a developer dynamically alters a generated `hx-*` attribute value, Flux surrenders ownership to the user.
- **Dynamic Attribute Sync**: When `fx-*` shorthand or preset options are edited or removed at runtime, reconciliation cleans up owned `hx-*` attributes cleanly.
- **Teardown Safety**: Hard disposal strips generated attributes without damaging pre-existing raw markup.

### Verbal Shorthand

Only verbs (plus three small conveniences) map to HTMX attributes — pure option aliases were
removed in 2.0 because raw `hx-target` next to `fx-get` needs no intermediary:

```
fx-get fx-post fx-put fx-patch fx-delete      →  hx-* verbs (make an element actionable)
fx-indicator                                  →  hx-indicator
fx-morph                                      →  hx-swap="innerMorph|outerMorph|outerSync"
fx-history                                    →  hx-push-url
```

Request configuration (`hx-target`, `hx-swap`, `hx-trigger`, `hx-sync`, `hx-vals`, …) is
written with raw htmx attributes. Presets keep reading their own option attributes
(`fx-target`, `fx-swap`, `fx-confirm`, …) through the preset registry.

### Presets

A few Flux attributes imply several HTMX attributes at once. `fx-search` expands into `hx-get` + `hx-trigger` + `hx-sync`. Presets expand **before** generic shorthand, so the generic pass sees the preset's `hx-*` already present and leaves them (raw-wins).

### Native HTMX 4 Status Routing

Status routing (`fx-on-422="#errors"`, `fx-on-404="#not-found"`) compiles directly into single canonical HTMX 4 status target attributes:

```html
<form fx-submit="/save" fx-on-422="#errors"></form>
```

Compiles to:

```html
<form hx-post="/save" hx-status:422='{"target":"#errors"}'></form>
```

HTMX 4 natively intercepts matching HTTP status codes and routes the swap target accordingly.

## Lifecycle seam

HTMX 4's processing pipeline (verified against the `4.0.0-beta6` source):

1. `htmx.process(root)` dispatches `htmx:before:process` on `root` (cancelable, bubbles to `document`).
2. HTMX queries its action selector (`[hx-action],[hx-get],[hx-post],...`) for elements to initialise.
3. For each element: `htmx:before:init` (cancelable) → `#initializeTriggers()` reads the element's attributes.

Flux registers a single document-level listener on `htmx:before:process` that reconciles generated attributes, expands `fx-*` presets, and writes the corresponding `hx-*` **in place**, before HTMX's discovery query runs. HTMX then does all the real work.

This gives the required properties:

- **Initial document works** — Flux expands before the first `process()`.
- **Swapped content works** — HTMX calls `process()` on swapped content, which re-fires `before:process`.
- **Idempotent** — expansion is a no-op when the target `hx-*` is already present; HTMX's own `_htmx.initialized` prevents double trigger registration.
- **No double handlers, no MutationObserver** — one listener, no DOM watcher, no full-document rescans on swap.

## Plugin Extension System

Custom presets can be registered via `Flux.use(plugin)`:

```js
Flux.use({
  name: 'my-plugin',
  setup(api) {
    return api.registerPreset('fx-custom', (element, value) => {
      // Connect custom preset
      return true;
    });
  },
});
```

Plugin preset registrations automatically track teardown functions and restore any previously overridden built-in preset definitions on `Flux.unuse()`.
