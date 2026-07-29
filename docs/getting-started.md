# Getting started

Flux is a thin, robust framework over HTMX 4 that expands `fx-*` shorthand attributes into `hx-*`
attributes. HTMX handles request and swap mechanics; Flux provides shorthand syntax, high-level presets, accessibility feedback, client caching, and native component controls.

> HTMX 4 is currently `4.0.0-beta6`. Flux pins this exact version for full compatibility.

## First example

A button that loads `/users` into `#users`:

```html
<button fx-get="/users" fx-target="#users">Load users</button>
```

At processing time, Flux expands this to `hx-get="/users" hx-target="#users"` on the same element.

## Quick Installation

The simplest setup is the pre-bundled IIFE, which includes HTMX 4 and Flux in a single script tag:

```html
<link rel="stylesheet" href="/flux.css" />
<button fx-get="/users" fx-target="#users">Load users</button>
<script src="/flux.full.iife.js"></script>
```

`flux.full.iife.js` loads HTMX and Flux in the correct order, exposes `window.Flux` and `window.htmx`, and starts automatically.

If your page already loads HTMX 4, use `flux.iife.js`:

```html
<!-- HTMX 4 (required first) -->
<script src="/htmx.js"></script>

<!-- Flux core (IIFE) -->
<script src="/flux.iife.js"></script>
```

## What works out of the box

- **Shorthand Verbs & Options**: `fx-get`, `fx-post`, `fx-put`, `fx-patch`, `fx-delete`, `fx-target`, `fx-swap`, `fx-indicator`, etc.
- **High-Level Presets**: `fx-search`, `fx-submit`, `fx-delete`, `fx-autosave`, `fx-load`, `fx-poll`, `fx-infinite`.
- **Status Routing**: `fx-on-422="#errors"`, `fx-on-404="#not-found"`.
- **Component Controls**: `fx-open="#modal"`, `fx-close="#modal"`, focus restoration.
- **Client Fragment Caching**: `fx-cache="60s"`, `fx-invalidate="key"`.
- **Accessible Feedback**: Live-region announcements via `fx-success` and `fx-error`.

## Documentation

- [attributes.md](./attributes.md) — full attribute reference & component controls.
- [presets.md](./presets.md) — search, submit, delete, autosave, poll, infinite scroll.
- [distribution.md](./distribution.md) — bundles, `window.Flux` inspection API, and meta configuration.
- [architecture.md](./architecture.md) — core engine architecture & lifecycle.
