---
title: Migrating from 1.x
---

# Migrating from 1.x to 2.x

2.0 was a breaking release. Everything below is the complete list of behaviour
changes, with the 2.x replacement.

## Attribute aliases removed

The pure `fx-*` → `hx-*` option aliases are gone. Write the native htmx attribute:

```html
<!-- 1.x -->
<a fx-get="/x" fx-target="#main" fx-swap="outerHTML" fx-trigger="click">

<!-- 2.x -->
<a fx-get="/x" hx-target="#main" hx-swap="outerHTML" hx-trigger="click">
```

Removed aliases: `fx-target`*, `fx-swap`, `fx-trigger`, `fx-select`, `fx-sync`,
`fx-include`, `fx-vals`, `fx-headers`, `fx-confirm`*, `fx-boost`, `fx-preload`,
`fx-preserve`.

\* These names still exist as **preset options** — they only mean something next to a
preset/verb: `<input fx-search="/s" fx-target="#r">` still works.

## fx-delete + fx-remove

```html
<!-- 1.x (buggy: could remove the button on page load) -->
<button fx-delete="/i/1" fx-remove="closest li">

<!-- 2.x -->
<button fx-delete="/i/1" fx-remove-target="closest li">
```

`fx-remove` is now duration-only self-removal: `fx-remove="3s"`.

## Visibility

One mechanism everywhere: the `hidden` class. `fx-hide` no longer leaves inline
opacity/display styles, so `fx-hide` + `fx-toggle` + `fx-show` compose freely.

## fx-open collision fixed

Accordion state moved to `data-fx-open`. `fx-open="#dialog"` reliably opens dialogs
and no longer swallows the `fx-close` branch.

## net entry split

Offline queue, upload and optimistic UI moved out of core:

```js
// 1.x: bundled in core
// 2.x:
import { installNet, offline, uploadPlugin, optimisticPlugin } from 'flux-htmx/net';
installNet();
```

## Optimistic rollback default

Rollback on failure is now the **default** for optimistic UI; the `fx-rollback`
opt-in attribute is gone.

## Bootstrap contract

```js
// 1.x: importing flux.js assigned window.Flux and auto-started
// 2.x:
import { bootstrapFlux } from 'flux-htmx';
bootstrapFlux();
```

CDN/IIFE builds call it for you — script-tag users change nothing.

## JS API

| 1.x | 2.x |
| --- | --- |
| `Flux.recipe(name, cfg)` | removed — presets + raw `hx-*` cover it |
| `Flux.action(name, steps)` | removed — use inline pipelines `fx-on-success="a; b"` |
| `main` → IIFE | real CJS: `require('flux-htmx')` works |
| peer `htmx.org` `4.0.0-beta6` exact | `^4.0.0-beta6` range |

## Version compatibility

Flux 2.x peer dependency: `htmx.org ^4.0.0-beta6`.
