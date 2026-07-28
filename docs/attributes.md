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

| Flux Attribute           | Compiled HTMX Attribute      | Effect                                                 |
| ------------------------ | ---------------------------- | ------------------------------------------------------ |
| `fx-on-422="#errors"`    | `hx-target-422="#errors"`    | Swaps 422 Unprocessable Entity response into `#errors` |
| `fx-on-404="#not-found"` | `hx-target-404="#not-found"` | Swaps 404 response into `#not-found`                   |

## Component & Dialog Attributes

Native HTML component controllers provide declarative modal & popover management:

| Attribute               | Target               | Behavior                                                                                           |
| ----------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `fx-open="#dialog-id"`  | `<dialog>` / Popover | Opens `<dialog>` with `showModal()`, moves focus to first input, restores focus to opener on close |
| `fx-close="#dialog-id"` | `<dialog>` / Popover | Closes target `<dialog>` (`close()`) or popover                                                    |
| `fx-close`              | Parent `<dialog>`    | Closes enclosing `<dialog>` element                                                                |

## Feedback & Lifecycle Attributes

| Attribute                                     | Scope                  | Behavior                                                       |
| --------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `fx-success="Message"`                        | Elements with requests | Screen reader announcement & Alpine toast push on HTTP 2xx     |
| `fx-error="Message"`                          | Elements with requests | Screen reader announcement & Alpine toast push on HTTP 4xx/5xx |
| `fx-reset`                                    | `<form>` elements      | Resets form inputs upon HTTP 2xx success                       |
| `fx-remove="this"` / `fx-remove="closest tr"` | Elements with requests | Removes element/ancestor from DOM upon HTTP 2xx success        |
| `fx-cache="60s"`                              | GET requests           | Enables client fragment caching with TTL                       |
| `fx-invalidate="key"`                         | Mutation requests      | Invalidates matching cache entries upon HTTP 2xx success       |
