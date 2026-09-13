---
title: Using Flux with Alpine.js
---

# Using Flux with Alpine.js

Flux and Alpine solve different problems and compose cleanly.

| Concern | Owner |
| --- | --- |
| Requests, swaps, caching, retries, toasts | **htmx + Flux** |
| Show/hide primitives, dropdowns | **Flux** (visibility layer) |
| Two-way binding (`x-model`), derived state | **Alpine** |
| Client-side list rendering, scoped stores | **Alpine** |
| Where the source of truth lives | **The server** |

## The division of labour

```html
<!-- Flux: the request layer (validation, CSRF, toast, cache invalidation) -->
<form fx-submit="/users" fx-validate fx-toast fx-success="Saved!"
      x-data="{ saving: false }"
      @flux:success="saving = false">

  <!-- Alpine: pure widget state for this screen -->
  <div x-data="{ step: 1, total: 3 }">
    <section x-show="step === 1">…</section>
    <section x-show="step === 2">…</section>
    <button type="button" @click="step = Math.min(step + 1, total)">Next</button>
  </div>

  <button>Save</button>
</form>
```

- htmx/Flux own the **request and the swap** — the server's HTML is the truth.
- Alpine owns the **interactive widget state** that never needs a server round-trip.

## Why Flux doesn't do reactive state

On purpose. Flux's promise is a thin, CSP-safe layer over htmx with server-rendered
HTML as the source of truth. Reactive client state is a different tool with different
trade-offs — and Alpine already does it excellently in ~15 kB. Bolting a
string-matching reactivity layer onto Flux would give you the worst of both.

## Practical tips

- Load order doesn't matter; Alpine's `x-data` and Flux's `fx-*` never touch the same
  attributes.
- Alpine components inside htmx-swapped content initialise automatically — Alpine
  watches the DOM; Flux just swaps the HTML.
- If you dispatch custom events from action pipelines
  (`fx-on-success="toast:Saved"`), Alpine can listen with `@flux:…` — the bridge is
  plain DOM events.
