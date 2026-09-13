# Attributes

Flux provides two kinds of attributes: **shorthand** (verbs plus a couple of small conveniences) and **presets** (one Flux attribute driving a whole pattern), along with **component/feedback attributes**.

All follow one precedence rule: **raw `hx-*` wins.** If an element already declares the HTMX attribute that a Flux attribute would produce, Flux leaves it alone.

## Verbs (shorthand)

Each verb shorthand expands to the identically named `hx-*` attribute, preserving the value.

| Flux        | HTMX        | Effect                                 |
| ----------- | ----------- | -------------------------------------- |
| `fx-get`    | `hx-get`    | Makes the element issue a GET request. |
| `fx-post`   | `hx-post`   | POST request.                          |
| `fx-put`    | `hx-put`    | PUT request.                           |
| `fx-patch`  | `hx-patch`  | PATCH request.                         |
| `fx-delete` | `hx-delete` | DELETE request (full preset, below).   |

```html
<button fx-get="/users" hx-target="#users">Load users</button>
```

expands to:

```html
<button fx-get="/users" hx-target="#users" hx-get="/users">Load users</button>
```

### Options are raw htmx attributes (2.0 change)

The pure option aliases were removed: write `hx-target`, `hx-swap`, `hx-trigger`, `hx-select`,
`hx-sync`, `hx-include`, `hx-vals`, `hx-headers`, `hx-confirm`, `hx-boost`, `hx-preload`, and
`hx-preserve` directly next to an `fx-*` verb. `fx-indicator` remains a generic alias, and
`fx-morph` / `fx-history` remain value-mapping shorthands (`hx-swap="innerMorph"`,
`hx-push-url`). Presets continue to accept their own option attributes (see
docs/presets.md).

## Status Routing

Status-specific targeting directs response HTML to a different container based on the HTTP status code:

| Flux Attribute           | Compiled HTMX Attribute                   | Effect                                                 |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------ |
| `fx-on-422="#errors"`    | `hx-status:422='{"target":"#errors"}'`    | Swaps 422 Unprocessable Entity response into `#errors` |
| `fx-on-404="#not-found"` | `hx-status:404='{"target":"#not-found"}'` | Swaps 404 response into `#not-found`                   |

## Component & Dialog Attributes

Native HTML component controllers provide declarative modal & popover management:

| Attribute               | Target               | Behavior                                                                                           |
| ----------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `fx-open="#dialog-id"`  | `<dialog>` / Popover | Opens `<dialog>` with `showModal()`, moves focus to first input, restores focus to opener on close |
| `fx-close="#dialog-id"` | `<dialog>` / Popover | Closes target `<dialog>` (`close()`) or popover                                                    |
| `fx-close`              | Parent `<dialog>`    | Closes enclosing `<dialog>` element                                                                |

## Retry, Deduplication & Cache Attributes

| Attribute                                | Scope             | Behavior                                                                               |
| ---------------------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| `fx-retry="3"`                           | GET/Safe requests | Automatically retries request up to 3 times on network failure or 502/503/504 errors   |
| `fx-retry-delay="500ms"`                 | Retry requests    | Sets base initial delay for retries (default `500ms`)                                  |
| `fx-retry-backoff="2"`                   | Retry requests    | Sets backoff multiplier (`delay * backoff ^ retryCount`)                               |
| `fx-retry-safe="true"`                   | Non-GET requests  | Explicitly enables automatic retry for non-GET requests                                |
| `fx-dedupe="true"`                       | GET requests      | Coalesces simultaneous identical in-flight GET requests into a single network call     |
| `fx-dedupe-vary="Accept-Language"`       | Dedupe requests   | Includes specified request headers in canonical deduplication key computation          |
| `fx-cache="5m"`                          | GET requests      | Enables fragment caching for 5 minutes                                                 |
| `fx-cache-mode="stale-while-revalidate"` | GET requests      | Instantly renders cached content, revalidates in background, and updates UI on changes |
| `fx-invalidate="key"`                    | Mutation requests | Invalidates matching cache entries upon HTTP 2xx success                               |

## Plugin & Feedback Attributes

| Attribute                            | Plugin               | Behavior                                                          |
| ------------------------------------ | -------------------- | ----------------------------------------------------------------- |
| `fx-upload="/files"`                 | Upload Plugin        | Configures multipart upload, drag-and-drop, and file validation   |
| `fx-max-size="20mb"`                 | Upload Plugin        | Validates maximum file size limit before issuing upload request   |
| `fx-allowed-types="image/*,.pdf"`    | Upload Plugin        | Validates allowed file MIME types or extensions before upload     |
| `fx-optimistic-remove="closest li"`  | Optimistic UI Plugin | Instantly removes element on click before request completes       |
| `fx-optimistic-class="hidden"`       | Optimistic UI Plugin | Instantly adds class to element on click before request completes |
| `fx-success="Message"`               | Feedback             | Screen reader announcement & Flux toast push on HTTP 2xx          |
| `fx-error="Message"`                 | Feedback             | Screen reader announcement & Flux toast push on HTTP 4xx/5xx      |
| `fx-reset`                           | `<form>` elements    | Resets form inputs upon HTTP 2xx success                          |
| `fx-remove="3s"` / `fx-remove="500"` | Self-removal preset  | Removes the element itself after the given duration               |
| `fx-remove-target="closest tr"`      | Delete preset        | Removes the matching ancestor/element from DOM upon HTTP 2xx      |
