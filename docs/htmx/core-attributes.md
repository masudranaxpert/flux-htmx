---
title: htmx 4 core attributes
---

# htmx 4 core attributes

## Request verbs

| Attribute | Description |
| --- | --- |
| `hx-get="/url"` | Issue HTTP `GET` |
| `hx-post="/url"` | Issue HTTP `POST` |
| `hx-put="/url"` | Issue HTTP `PUT` |
| `hx-patch="/url"` | Issue HTTP `PATCH` |
| `hx-delete="/url"` | Issue HTTP `DELETE` |
| `hx-query="/url"` | Issue HTTP `QUERY` (new in 4.0) |

4.0 also adds a form-style alternative:

```html
<button hx-action="/info" hx-method="GET">Get Information</button>
```

All of these work on **any element**. Natural triggers: `click` for most elements,
`submit` for forms, `change` for inputs/selects/textareas.

## Target and swap

```html
<button hx-get="/row" hx-target="closest tr" hx-swap="outerHTML">Load</button>
```

| Attribute | Description |
| --- | --- |
| `hx-target` | CSS selector receiving the response (`this`, `closest x`, `find x`, `next x`, `previous x`) |
| `hx-swap` | `innerHTML` (default) · `outerHTML` · `beforebegin` · `afterbegin` · `beforeend` · `afterend` · `delete` · `none` |
| `hx-select` | Pick a sub-fragment of the response HTML |
| `hx-swap-oob` | Mark response fragments as out-of-band replacements |
| `hx-morph` | Morph-style swap (preserve DOM state) |
| `hx-preserve` | Keep an element across swaps |

Swap modifiers: `hx-swap="innerHTML swap:200ms settle:100ms scroll:top show:top"`.

## Triggers — hx-trigger

```html
<div hx-get="/news" hx-trigger="every 30s">…</div>
<input hx-get="/search" hx-trigger="input changed delay:300ms from:find input">
<button hx-get="/x" hx-trigger="click once">…</button>
```

| Modifier | Meaning |
| --- | --- |
| `delay:300ms` | Debounce |
| `throttle:1s` | Throttle |
| `changed` | Only when the value changed |
| `once` | Fire once |
| `from:SELECTOR` | Listen on another element |
| `every 30s` | Polling |
| `load` / `revealed` | On load / when scrolled into view |

Filters: `hx-trigger="click[event.detail.ctrKey]"`.

## Sending data

| Attribute | Description |
| --- | --- |
| `hx-include="SELECTOR"` | Include other elements' values |
| `hx-vals='{"k":"v"}'` | Static values (add `js:` prefix for computed) |
| `hx-params="not secret"` | Filter submitted parameters |
| `hx-encoding="multipart/form-data"` | File uploads |

## Headers and URLs

| Attribute | Description |
| --- | --- |
| `hx-headers='{"X-Auth":"t"}'` | Extra request headers |
| `hx-push-url="true\|URL"` | Push URL into browser history |
| `hx-replace-url` | Replace instead of push |
| `hx-history="false"` | Opt an element out of history snapshots |
| `hx-sync="closest form:abort"` | Request strategy: `abort` \| `replace` \| `skip` \| `queue all/first/last` |
| `hx-boost="true"` | Upgrade anchors/forms to ajax |
| `hx-preserve` / `hx-ext` | (see htmx docs) |

!!! tip "Flux shorthand"

    `fx-history` = `hx-push-url`, `fx-morph` = morph swap, `fx-prefetch` = cache-warming
    GET. Presets compose these with retries/toasts — see
    [presets](../attributes/presets.md).

## Status targeting (4.0)

4xx/5xx responses **swap by default** in 4.0. Retarget per status code:

```html
<form hx-post="/login" hx-status:401='{"target":"#login-prompt"}'>…</form>
```

Flux's `fx-on-401="#login-prompt"` compiles to exactly this — see
[status targeting](../attributes/status.md).
