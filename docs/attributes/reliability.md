---
title: Reliability & Scoping
---

# Reliability & Scoping

Fine-grained controls for request retries, in-flight request deduplication, HTTP method configuration, and hierarchical default options inheritance.

## Per-Element Retry Tuning

While global retry settings can be configured via `<meta name="flux-config">`, individual elements can declare custom retry strategies:

```html
<!-- Retry up to 3 times with 1s base delay and exponential backoff -->
<button
  fx-post="/critical-sync"
  fx-retry="3"
  fx-retry-delay="1000ms"
  fx-retry-backoff="2"
  fx-retry-safe="true"
>
  Sync Data
</button>
```

| Attribute          | Default | Description                                                               |
| ------------------ | ------- | ------------------------------------------------------------------------- |
| `fx-retry`         | `2`     | Maximum retry attempts for this element (e.g. `3`, or `false` to disable) |
| `fx-retry-delay`   | `500ms` | Initial backoff delay before the first retry attempt                      |
| `fx-retry-backoff` | `2`     | Exponential backoff multiplier                                            |
| `fx-retry-safe`    | `false` | When `true`, allows retrying non-idempotent methods (POST/DELETE)         |

## In-Flight Request Deduplication (`fx-dedupe`)

Prevents concurrent identical requests from causing redundant network traffic:

```html
<!-- Deduplicate concurrent clicks/triggers to this search query -->
<input fx-search="/api/lookup" fx-dedupe="true" fx-dedupe-vary="X-Account-Id,Accept-Language" />
```

| Attribute        | Default | Description                                                                              |
| ---------------- | ------- | ---------------------------------------------------------------------------------------- |
| `fx-dedupe`      | `false` | Explicitly enables request deduplication on this element                                 |
| `fx-dedupe-vary` | —       | Comma-separated list of request headers that must be factored into the deduplication key |

## Method Override (`fx-method`)

For presets like `fx-submit` and `fx-autosave` that default to `POST`, `fx-method` allows overriding the HTTP verb:

```html
<!-- Submit via PUT instead of POST -->
<form fx-submit="/users/42" fx-method="put">
  <input name="email" value="alex@example.com" />
  <button type="submit">Update</button>
</form>

<!-- Autosave via PATCH -->
<form fx-autosave="/drafts/12" fx-method="patch">
  <textarea name="content">Live editing...</textarea>
</form>
```

| Attribute   | Allowed Values                   | Description                                                 |
| ----------- | -------------------------------- | ----------------------------------------------------------- |
| `fx-method` | `post`, `put`, `patch`, `delete` | Overrides the HTTP verb used by form submission or autosave |

## Scoping & Defaults Inheritance (`fx-scope`, `fx-default-*`)

`fx-scope` creates a hierarchical boundary where child elements inherit default configuration options without repeating them on every element:

```html
<section fx-scope fx-default-target="#results" fx-default-indicator="#spinner">
  <!-- Inherits hx-target="#results" and hx-indicator="#spinner" automatically -->
  <button fx-get="/items">Load Items</button>
  <button fx-get="/users">Load Users</button>

  <!-- Explicit attributes on elements always override scope defaults -->
  <button fx-get="/special" hx-target="#sidebar">Special</button>
</section>
```

- **`fx-scope`**: Declares a container element as an option scope.
- **`fx-default-[key]="value"`**: Sets a default option for descendants.
  - Htmx options (`fx-default-target`, `fx-default-swap`, `fx-default-indicator`, etc.) automatically map to their respective `hx-*` attributes on descendants.
  - Preset options (`fx-default-confirm`, `fx-default-delay`, etc.) map to `fx-*` attributes.
  - Explicit attributes directly on descendant elements always take precedence over inherited scope defaults.
