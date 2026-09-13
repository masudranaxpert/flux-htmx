---
title: Bundles & distribution
---

# Bundles & distribution

| File                        | Format | Contents                                       | Primary use case                                   |
| --------------------------- | ------ | ---------------------------------------------- | -------------------------------------------------- |
| `flux.full.iife.js`         | IIFE   | htmx 4 + core + UI plugins + net               | All-in-one `<script>` (Django, Laravel, Go, Rails) |
| `flux.iife.js`              | IIFE   | core + UI plugins, htmx from `globalThis.htmx` | htmx pre-loaded separately                         |
| `net.iife.js`               | IIFE   | offline queue + upload/optimistic → `FluxNet`  | optional add-on after `flux.iife.js`               |
| `flux.js`                   | ESM    | core, htmx as peer dependency                  | Vite/Webpack/Next                                  |
| `net.js`                    | ESM    | net extras (`flux-htmx/net`)                   | opt-in                                             |
| `flux.cjs`                  | CJS    | core                                           | `require("flux-htmx")`                             |
| `net.cjs`                   | CJS    | net extras                                     | `require("flux-htmx/net")`                         |
| `flux.full.js`              | ESM    | htmx + everything                              | standalone ESM                                     |
| `flux.css` / `flux.min.css` | CSS    | toasts, `hidden` contract, live region         | always include                                     |

## Exports map

```json
{
  ".": {
    "import": "./dist/flux.js",
    "require": "./dist/flux.cjs",
    "default": "./dist/flux.iife.js"
  },
  "./net": {
    "import": "./dist/net.js",
    "require": "./dist/net.cjs",
    "default": "./dist/net.iife.js"
  }
}
```

## Duplicate loading

If Flux or htmx is loaded twice (e.g. standalone + inside the full bundle), the
`duplicatePolicy` decides: `reuse` (default), `warn` (reuse + console warning) or
`error` (throw). See [configuration](configuration.md).

## Version pinning

```html
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js"></script>
```

`@2` tracks fixes within the major; pin the exact version for production builds.
`FLUX_VERSION` is generated from `package.json` at build time — no drift.
