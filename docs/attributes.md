# Attributes

Flux provides three kinds of attributes: **generic shorthand** (1:1 renames of HTMX attributes), **presets** (one Flux attribute expanding to several HTMX attributes), and **component/feedback attributes**.

All follow one precedence rule: **raw `hx-*` wins.** If an element already declares the HTMX attribute that a Flux attribute would produce, Flux leaves it alone.

## Generic shorthand

Each `fx-*` attribute expands to the identically named `hx-*` attribute, preserving the value.

### Verbs

| Flux        | HTMX        | Effect                                 |
| ----------- | ----------- | -------------------------------------- |
| `fx-get`    | `hx-get`    | Makes the element issue a GET request. |
| `fx-post`   | `hx-post`   | POST request.                          |
| `fx-put`    | `hx-put`    | PUT request.                           |
| `fx-patch`  | `hx-patch`  | PATCH request.                         |
| `fx-delete` | `hx-delete` | DELETE request.                        |

```html
<button fx-get="/users" fx-target="#users">Load users</button>
```

expands to:

```html
<button fx-get="/users" fx-target="#users" hx-get="/users" hx-target="#users">Load users</button>
```

### Options

| Flux           | HTMX           |
| -------------- | -------------- |
| `fx-target`    | `hx-target`    |
| `fx-swap`      | `hx-swap`      |
| `fx-trigger`   | `hx-trigger`   |
| `fx-select`    | `hx-select`    |
| `fx-sync`      | `hx-sync`      |
| `fx-indicator` | `hx-indicator` |
| `fx-include`   | `hx-include`   |
| `fx-vals`      | `hx-vals`      |
| `fx-headers`   | `hx-headers`   |
| `fx-disable`   | `hx-disable`   |
| `fx-confirm`   | `hx-confirm`   |
| `fx-boost`     | `hx-boost`     |
| `fx-preload`   | `hx-preload`   |

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

| Attribute                                     | Plugin               | Behavior                                                           |
| --------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| `fx-upload="/files"`                          | Upload Plugin        | Configures multipart upload, drag-and-drop, and file validation    |
| `fx-max-size="20mb"`                          | Upload Plugin        | Validates maximum file size limit before issuing upload request    |
| `fx-allowed-types="image/*,.pdf"`             | Upload Plugin        | Validates allowed file MIME types or extensions before upload      |
| `fx-optimistic-remove="closest li"`           | Optimistic UI Plugin | Instantly removes element on click before request completes        |
| `fx-optimistic-class="hidden"`                | Optimistic UI Plugin | Instantly adds class to element on click before request completes  |
| `fx-rollback`                                 | Optimistic UI Plugin | Automatically restores original element DOM state if request fails |
| `fx-success="Message"`                        | Feedback             | Screen reader announcement & Flux toast push on HTTP 2xx           |
| `fx-error="Message"`                          | Feedback             | Screen reader announcement & Flux toast push on HTTP 4xx/5xx       |
| `fx-reset`                                    | `<form>` elements    | Resets form inputs upon HTTP 2xx success                           |
| `fx-remove="this"` / `fx-remove="closest tr"` | Delete preset        | Removes element/ancestor from DOM upon HTTP 2xx success            |
