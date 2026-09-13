---
title: Installation
---

# Installation

## Package manager

```bash
npm install flux-htmx
npm install htmx.org@^4.0.0-beta6   # peer dependency for the core builds
```

### ESM (Vite, Webpack, esbuild…)

```js
import { bootstrapFlux } from 'flux-htmx';

bootstrapFlux(); // publishes window.Flux and honours <meta name="flux-config">
```

Importing the module has **no global side effects** — modular consumers opt in.
`bootstrapFlux()` installs the runtime, applies meta-tag configuration and publishes
`window.Flux` unless something is already there.

### CommonJS

```js
const Flux = require('flux-htmx').default;
```

A real CJS build ships as `dist/flux.cjs` — `main` points at it, so plain
`require('flux-htmx')` works in bundlers that still consume CJS.

### Optional net entry

Offline queue, upload progress and optimistic UI live in a separate entry so core
users ship less:

```js
import { installNet } from 'flux-htmx/net';
installNet();
```

## CDN

=== "jsDelivr"

    ```html
    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.min.css" />
    ```

=== "unpkg"

    ```html
    <script src="https://unpkg.com/flux-htmx@2/dist/flux.full.iife.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/flux-htmx@2/dist/flux.min.css" />
    ```

### Bundle matrix

| File | Contents | Size (gzip) |
| --- | --- | --- |
| `flux.full.iife.js` | htmx 4 + core + UI plugins + net extras | ~35 kB |
| `flux.iife.js` | core + UI plugins, htmx from `globalThis.htmx` | ~20 kB |
| `net.iife.js` | offline queue + upload/optimistic (optional) | ~3 kB |
| `flux.js` / `flux.cjs` | modular ESM / CJS, htmx as peer | ~20–22 kB |
| `flux.full.js` | standalone ESM with everything | ~40 kB |

!!! warning "Don't mix bundles"

    Loading the full bundle after the modular bundle is not supported — the
    duplicate-load policy reuses the first `window.Flux` it sees.

## Pin a version

```html
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2.1.0/dist/flux.full.iife.js"></script>
```

Pinning the major (`@2`) gets you fixes without breaking changes; pinning the exact
version is safest for production.
