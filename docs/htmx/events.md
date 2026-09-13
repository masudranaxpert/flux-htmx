---
title: htmx 4 events & headers
---

# htmx 4 events & headers

htmx 4 rationalized event names (4.0 dropped the legacy double-named aliases). Flux
listens on this same pipeline — that's the whole integration surface.

## Request pipeline events

Fired on the triggering element and bubbling to `document`:

| Event                                                      | Fired when                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `htmx:config:request`                                      | Before issue — mutate `detail.ctx.request` (headers, timeout, signal). **Flux attaches CSRF/timeout/credentials here.** |
| `htmx:before:request`                                      | Request issued                                                                                                          |
| `htmx:before:process`                                      | Response about to be processed — **Flux wires `fx-on-*` status rules here**                                             |
| `htmx:before:swap`                                         | Before the swap (can `preventDefault`)                                                                                  |
| `htmx:after:swap`                                          | Swap done                                                                                                               |
| `htmx:after:settle`                                        | Attributes settled — **Flux re-inits persist/dirty here**                                                               |
| `htmx:after:request`                                       | Outcome known — **Flux retries, feedback, `fx-on-success` pipelines run here**                                          |
| `htmx:before:cleanup`                                      | Element removed — **Flux disconnects presets here**                                                                     |
| `htmx:confirm`                                             | Confirm gate — **Flux's native/dialog confirms hook in here**                                                           |
| `htmx:sendError` / `htmx:responseError` / `htmx:sendAbort` | Network / HTTP / abort failures                                                                                         |

Example — global busy state:

```js
document.addEventListener('htmx:before:request', () => (document.body.dataset.busy = ''));
document.addEventListener('htmx:after:request', () => delete document.body.dataset.busy);
```

## Event detail (ctx)

`htmx:config:request` / `htmx:after:request` carry `detail.ctx`:

| Field                              | Description                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `ctx.request`                      | `{ method, action, headers, timeout, signal, credentials, parameters }` |
| `ctx.source`                       | The triggering element                                                  |
| `ctx.target` / `ctx.targetElement` | Swap target                                                             |
| `ctx.successful` / `ctx.failed`    | Outcome booleans                                                        |
| `ctx.response`                     | `{ status, ... }` (after request)                                       |

## Response headers (server side)

| Header                                              | Effect                                     |
| --------------------------------------------------- | ------------------------------------------ |
| `HX-Trigger: {"event": …}`                          | Fire client events after settle            |
| `HX-Trigger-After-Swap` / `HX-Trigger-After-Settle` | Same, timed differently                    |
| `HX-Location`                                       | Client-side navigation without a full swap |
| `HX-Redirect`                                       | Redirect the browser                       |
| `HX-Refresh`                                        | Full page refresh                          |
| `HX-Push-Url` / `HX-Replace-Url`                    | Control history                            |
| `HX-Reswap` / `HX-Retarget`                         | Override the client's swap/target          |
| `HX-Reselect`                                       | Override `hx-select`                       |

## Notes for Flux users

- Every Flux feature is implementable with raw htmx events — Flux presets are
  conveniences over this exact surface.
- Custom events you dispatch in server responses (`HX-Trigger`) are the cleanest way
  to talk to Alpine components after a swap.
