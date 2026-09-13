---
title: Custom events
---

# Custom events reference

Flux communicates through plain DOM events — listen anywhere, or bridge into Alpine
with `@flux:…`.

## Request lifecycle

| Event                 | When                                                        | Detail      |
| --------------------- | ----------------------------------------------------------- | ----------- |
| `htmx:config:request` | Before issue — Flux attaches CSRF, timeout, credentials     | htmx detail |
| `htmx:before:request` | Request issued                                              | htmx detail |
| `htmx:after:request`  | Outcome known — action pipelines (`fx-on-success`) run here | htmx detail |
| `htmx:after:settle`   | DOM settled — persist/form re-init here                     | `{ el }`    |
| `htmx:before:cleanup` | Element being removed — Flux disconnects presets            | htmx detail |

## Flux events

| Event                   | When                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `flux:persist:restored` | An `fx-persist` field was restored (bubbles). **Not** a synthetic `change` — autosave won't fire |
| `flux:action:error`     | An action inside a pipeline threw (`detail.action`, `detail.error`)                              |
| `flux:toast`            | A toast was requested (used by the built-in toaster)                                             |

## Example: progress per request

```js
document.addEventListener('htmx:before:request', () => {
  document.body.setAttribute('data-busy', '');
});
document.addEventListener('htmx:after:request', () => {
  document.body.removeAttribute('data-busy');
});
```

## Server-driven actions

htmx dispatches events from the `HX-Trigger` response header. Flux binds
`flux:action` to its action pipeline, so the server can orchestrate the client:

```go
w.Header().Set("HX-Trigger",
  `{"flux:action":"toast:Saved; close:#edit; invalidate:GET:/containers*"}`)
```

Built-in actions: `toast`, `close`, `open`, `reset`, `refresh`, `remove`,
`invalidate` — plus anything registered via `Flux.registerAction()`.

## Example: Alpine bridge

```html
<div x-data @flux:persist:restored="console.log('restored', $event.target.name)"></div>
```
