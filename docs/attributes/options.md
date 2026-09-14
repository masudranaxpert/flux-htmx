---
title: Preset options
---

# Preset options

Presets read these attributes themselves. They are **not** global aliases — they only
mean something next to a preset or verb. Htmx-level behaviour is configured with the
native `hx-*` attributes.

## Targeting and swapping

| Attribute    | Example     | Description                                                          |
| ------------ | ----------- | -------------------------------------------------------------------- |
| `fx-target`  | `#rows`     | Target for the preset's requests (maps to `hx-target` when expanded) |
| `fx-swap`    | `outerHTML` | Swap style for the preset                                            |
| `fx-select`  | `#fragment` | Pick a sub-fragment of the response                                  |
| `fx-append`  | `#list`     | Append response to an element                                        |
| `fx-prepend` | `#list`     | Prepend response to an element                                       |

## Timing

| Attribute       | Example | Description                            |
| --------------- | ------- | -------------------------------------- |
| `fx-delay`      | `300ms` | Debounce window (search, autosave)     |
| `fx-interval`   | `5s`    | Polling interval alias                 |
| `fx-min-length` | `3`     | Minimum input length before requesting |

## Feedback

| Attribute      | Example    | Description                           |
| -------------- | ---------- | ------------------------------------- |
| `fx-indicator` | `#spinner` | Element shown while the request runs  |
| `fx-disable`   | —          | Disable the source during the request |
| `fx-toast`     | —          | Show a built-in toast on completion   |
| `fx-success`   | `Saved!`   | Success toast/message                 |
| `fx-error`     | `Failed!`  | Error toast/message                   |

## Confirmation and validation

| Attribute           | Example      | Description                                                         |
| ------------------- | ------------ | ------------------------------------------------------------------- |
| `fx-confirm`        | `Sure?`      | Native `confirm()` before issuing the request                       |
| `fx-confirm-dialog` | `#dlg`       | Use your own `<dialog id="dlg">` instead                            |
| `fx-validate`       | —            | HTML5 constraint validation before submit                           |
| `fx-focus-error`    | —            | Focus first invalid field on validation failure                     |
| `fx-dirty-message`  | `Custom msg` | Custom confirmation prompt when leaving or dismissing unsaved edits |

## Result side effects

| Attribute          | Example      | Description                                |
| ------------------ | ------------ | ------------------------------------------ |
| `fx-reset`         | —            | Reset the form after success               |
| `fx-invalidate`    | `/users/*`   | Clear matching cache entries after success |
| `fx-remove-target` | `closest tr` | Remove an element after success            |
| `fx-search-clear`  | `#q,#alt`    | Clear fields when the query empties        |

## Networking

| Attribute             | Example     | Description                                                  |
| --------------------- | ----------- | ------------------------------------------------------------ |
| `fx-with-credentials` | —           | Send credentials cross-origin                                |
| `fx-cache`            | `60s`       | Cache the GET response (see [caching](../guides/caching.md)) |
| `fx-cache-key`        | `stats-v1`  | Explicit cache key                                           |
| `fx-cache-vary`       | `user,lang` | Fields the cache key must vary on                            |
| `fx-cache-mode`       | `strict`    | `strict` (default) or relaxed safety policy                  |
| `fx-max-size`         | `50`        | Max cached fragments (LRU)                                   |
| `fx-allowed-types`    | `text/html` | Only cache these content types                               |
| `fx-event`            | `ticket`    | SSE event name for `fx-realtime`                             |

## Removal

| Attribute          | Example      | Description                            |
| ------------------ | ------------ | -------------------------------------- |
| `fx-remove`        | `5s`         | Self-remove after a **duration**       |
| `fx-remove-target` | `closest tr` | Remove a related element after success |

!!! warning "fx-remove is duration-only since 2.0"

    `fx-remove="closest li"` was a 1.x trap that could delete elements on page load.
    Use `fx-remove-target` to name a related element.

## Status targeting

```html
<form fx-submit="/login" fx-on-401="#login-prompt" fx-on-422="#errors">…</form>
```

`fx-on-<code>="selector"` retargets the swap when the response carries that status —
compiled to native HTMX 4 status targeting. See [status targeting](status.md).
