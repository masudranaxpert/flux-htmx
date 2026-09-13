---
title: Getting started
---

# Getting started

Flux layers request superpowers on top of HTMX 4. This page gets you from zero to a
working request in under two minutes.

## 1. Load htmx and Flux

=== "CDN — one script"

    ```html
    <body>
      <!-- your app -->
      <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
    </body>
    ```

    The full bundle includes HTMX 4, all Flux presets, UI plugins and the optional
    net extras — and boots itself.

=== "CDN — htmx separate"

    ```html
    <script src="https://cdn.jsdelivr.net/npm/htmx.org@2/dist/htmx.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.iife.js"></script>
    ```

=== "Bundler (Vite, Webpack…)"

    ```bash
    npm install flux-htmx htmx.org
    ```

    ```js
    import { bootstrapFlux } from 'flux-htmx';

    bootstrapFlux(); // publishes window.Flux and starts the runtime
    ```

!!! note "Where to put the script"

    End of `<body>` is the classic spot. If the script lands in `<head>` (or is moved
    there later), Flux still boots — plugins wait for the DOM instead of crashing.

## 2. Add the stylesheet

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.min.css" />
```

This ships the toast styles, the `hidden` class contract and the ARIA live region.

## 3. Configure CSRF (server-rendered apps)

Flux reads your CSRF token and attaches it to every mutating request:

```html
<!-- Django / Flask / Rails style -->
<meta name="csrf-token" content="{{ csrf_token }}" />
<meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
```

See [CSRF guide](guides/csrf.md) for Django, FastAPI and Go specifics.

## 4. Make your first Flux request

```html
<!-- Native htmx does the targeting; Flux adds prefetch + caching -->
<a hx-get="/products" hx-target="#main" fx-prefetch fx-cache>Products</a>

<!-- Flux preset: debounced search without eval -->
<input fx-search="/search" fx-target="#results" hx-trigger="input changed delay:300ms" />

<!-- Flux verb: delete with confirm + toast + row removal -->
<button fx-delete="/item/42" fx-confirm="Delete this item?" fx-toast
        fx-success="Deleted!" fx-remove-target="closest tr">
  Delete
</button>
```

## 5. Verify the installation

Open the console and run:

```js
Flux.doctor();
```

A healthy report lists the detected htmx version, registered presets, plugins and
configuration. `Flux.inspect(element)` explains what Flux sees on a single element.

## Next steps

- [Attributes reference](attributes/verbs.md) — every `fx-*` verb, preset and option
- [Forms guide](guides/forms.md) — validation, confirms, dirty tracking, autosave
- [Configuration reference](reference/configuration.md) — the `flux-config` meta tag
