---
title: Offline, upload & optimistic UI
---

# Offline queue, upload & optimistic UI

These features ship in the **optional `net` entry** so core users don't download
them. The full CDN bundle (`flux.full.iife.js`) already includes everything.

=== "CDN"

    ```html
    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.iife.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/net.iife.js"></script>
    <!-- window.FluxNet is available -->
    ```

=== "Bundler"

    ```js
    import { installNet } from 'flux-htmx/net';
    installNet();
    ```

`installNet()` is idempotent and returns a teardown.

## Offline queue — fx-offline

```html
<button fx-post="/like" fx-offline>Like</button>
```

When the request fails because the browser is offline, it is queued in `localStorage`
and flushed automatically when connectivity returns.

```js
FluxNet.offline.pending; // number of queued requests
await FluxNet.offline.flush();
FluxNet.offline.clear();
```

!!! warning "Experimental — know the limits"

    The queue stores plain request parameters. It does **not** preserve files/FormData,
    custom headers, target/swap metadata, expiry, or sensitive-field filtering. Do not
    use it for sensitive or file-bearing requests.

## Upload progress — uploadPlugin

```js
Flux.use(uploadPlugin);
```

```html
<form fx-submit="/upload" hx-encoding="multipart/form-data">
  <input type="file" name="file" />
  <progress class="htmx-indicator" max="100"></progress>
</form>
```

Wires `htmx:xhr:progress` to a `<progress>` indicator for file uploads.

## Optimistic UI — optimisticPlugin

```js
Flux.use(optimisticPlugin);
```

```html
<button
  fx-post="/like"
  fx-optimistic-add-class="liked"
  hx-target="closest button"
  fx-optimistic-remove="closest tr"
>
  Like
</button>
```

Applies the visual change **immediately** on click and reconciles with the server's
response. On failure, the change **rolls back by default** — the element is restored
to its original position/state (previously opt-in via `fx-rollback`; since 2.0
rollback is the default behaviour).

Rollback is snapshot-based: the source element is removed from the DOM on success
(e.g. `fx-optimistic-remove`), then a failure response arrives — the plugin restores
it even when htmx's own after-request events can't reach the detached node.
