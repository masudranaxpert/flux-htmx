# Presets

A preset is a single `fx-*` attribute that expands to several HTMX attributes at once. Presets
expand **before** generic shorthand, and raw `hx-*` always wins — if you set `hx-trigger`
manually, the preset's trigger is not applied.

Presets expand into ordinary HTMX; you can always replace a preset with the raw `hx-*`
equivalents shown below.

## fx-search

Debounced, race-safe live search on an `<input>`.

**Expansion**

```html
<input hx-get="<url>" hx-trigger="flux:search-ready" hx-sync="this:replace" />
```

`fx-search` uses a native event listener to debounce input and enforce `fx-min-length` (eval-free). `fx-delay` defaults to `300ms`; `fx-min-length` defaults to `0`. `hx-sync="this:replace"`
aborts an in-flight request when a newer search fires, preventing stale responses.

**Example**

```html
<input fx-search="/users/search" fx-target="#results" fx-delay="300ms" fx-min-length="2" />
```

## fx-submit

High-level form submit preset. Configures debounced submission, reset on success, and feedback announcements.

**Expansion**

```html
<form hx-post="<url>" hx-target="<target>" hx-swap="<swap>" hx-indicator="<indicator>"></form>
```

Optionally handles `fx-reset` (resets form on 2xx response), `fx-success="Message"`, `fx-error="Message"`, and `fx-invalidate="key"`.

**Example**

```html
<form
  fx-submit="/api/users"
  fx-target="#users-table"
  fx-reset
  fx-success="User created successfully"
  fx-error="Could not create user"
  fx-invalidate="users:list"
>
  ...
</form>
```

## fx-delete

High-level delete preset. Expands to `hx-delete` with item removal, confirmation, and cache invalidation.

**Expansion**

```html
<button hx-delete="<url>" hx-confirm="<msg>" hx-target="<target>"></button>
```

Optionally handles `fx-remove="this"` (or `fx-remove="closest tr"`) to remove the target DOM element upon HTTP 2xx success.

**Example**

```html
<button
  fx-delete="/api/items/42"
  fx-confirm="Are you sure?"
  fx-remove="closest tr"
  fx-success="Item deleted"
  fx-invalidate="items:*"
>
  Delete
</button>
```

## fx-page (Pagination & Load More)

High-level pagination and load-more preset with configurable swap strategies (`fx-append` for `beforeend`, `fx-prepend` for `afterbegin`).

**Expansion**

```html
<button hx-get="<url>" hx-target="<target>" hx-swap="beforeend|afterbegin"></button>
```

**Example**

```html
<button fx-page="/products?page=2" fx-target="#products" fx-append>Load more</button>
```

## fx-autosave

Automatic background form save preset.

**Expansion**

```html
<form
  hx-post="<url>"
  hx-trigger="input changed delay:<delay>, change changed"
  hx-sync="this:replace"
></form>
```

`fx-delay` defaults to `500ms`. `hx-sync="this:replace"` aborts older pending saves when new input is entered.

**Example**

```html
<form fx-autosave="/api/draft" fx-delay="1s">
  <input name="title" />
  <textarea name="content"></textarea>
</form>
```

## fx-load

Fetch and swap content as soon as the element is added to the document.

**Syntax**

```html
<div fx-load="<url>" fx-target="<selector>" fx-swap="<strategy>"></div>
```

**Expansion**

```html
<div hx-get="<url>" hx-trigger="load" hx-target="<selector>" hx-swap="<strategy>"></div>
```

**Example**

```html
<aside fx-load="/notifications" fx-target="this" fx-swap="innerHTML"></aside>
```

## fx-poll

Fetch on a fixed interval with overlap prevention. The value is an interval string (`2s`, `500ms`) or a bare number of seconds.

**Syntax**

```html
<div fx-poll="<url> <interval>" fx-target="<selector>"></div>
```

**Expansion**

```html
<div
  hx-get="<url>"
  hx-trigger="every <interval>"
  hx-sync="this:replace"
  hx-target="<selector>"
></div>
```

**Example**

```html
<div fx-poll="/dashboard/stats 5s" fx-target="this"></div>
```

expands to `hx-get="/dashboard/stats" hx-trigger="every 5s" hx-sync="this:replace"`.

## fx-infinite

Load more content when an element scrolls into view with overlap prevention — the building block of infinite scroll.

**Syntax**

```html
<div fx-infinite="<url>" fx-target="<selector>" fx-swap="<strategy>"></div>
```

**Expansion**

```html
<div
  hx-get="<url>"
  hx-trigger="revealed"
  hx-sync="this:drop"
  hx-target="<selector>"
  hx-swap="<strategy>"
></div>
```

**Example**

```html
<div fx-infinite="/items?page=2" fx-target="#list" fx-swap="beforeend"></div>
```

## fx-realtime

Server-Sent Events (SSE) preset that automatically connects to an event stream and swaps incoming messages into the DOM. Zero dependencies, fully native `EventSource`.

**Syntax**

```html
<div fx-realtime="<url>" fx-target="<selector>" fx-swap="<strategy>" fx-event="<event-name>"></div>
```

**Example**

```html
<div fx-realtime="/events/live" fx-target="#feed" fx-swap="afterbegin" fx-event="new_order"></div>
```

## Plugin Presets

Decoupled plugin presets registered via `Flux.use(plugin)`:

### Upload Progress Plugin (`fx-upload`)

```html
<form fx-upload="/api/files" fx-max-size="20mb">
  <input type="file" multiple />
</form>
```

### Optimistic UI Plugin (`fx-optimistic-remove`)

```html
<button fx-delete="/tasks/1" fx-optimistic-remove="closest li" fx-rollback>Delete</button>
```

## Notes

- Other generic shorthand on the same element (e.g. `fx-headers`, `fx-vals`) expands normally alongside a preset. To override a preset, set the corresponding `hx-*` directly; the raw attribute wins.
