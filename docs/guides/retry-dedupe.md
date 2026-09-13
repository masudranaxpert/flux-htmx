---
title: Retry & dedupe
---

# Retry & dedupe

Two safety nets around every htmx request, on by default and configurable from the
`flux-config` meta tag or `Flux.reconfigure()`.

## Automatic retry

Transient failures (network errors, timeouts, 502/503/504) are retried with
exponential backoff and jitter.

```html
<meta name="flux-config" content='{
  "retry": { "maxRetries": 3, "baseDelayMs": 500, "maxDelayMs": 8000 }
}' />
```

| Option | Default | Description |
| --- | --- | --- |
| `maxRetries` | `2` | Attempts after the first failure |
| `baseDelayMs` | `500` | First backoff delay |
| `maxDelayMs` | `8000` | Backoff ceiling |

Guarantees:

- **Headers survive**: retries replay the original request headers — CSRF token and
  auth included — with `X-Flux-Retry: true` appended.
- **No confirm replays**: retries go through `htmx.ajax()` directly. If the runtime
  is unavailable, Flux skips with a warning instead of re-clicking your element
  (which would replay `hx-confirm` dialogs).
- **Timers are per element** and cleared when the element is removed from the DOM or
  on `Flux.dispose()`.

## In-flight dedupe

Duplicate concurrent requests from the same source to the same action collapse into
one network request. Followers receive the leader's outcome — no aborts, no lost
UI state.

Safety deadline: an in-flight key is released after **30 seconds** even if the
leader's completion event never arrives (page hidden, listener exception), so a lost
leader can never block future requests as aborted followers.

## Cache interplay

Retry and dedupe compose with the [fragment cache](caching.md): a retried request
still writes the cache once; deduped followers inherit the leader's cache write.
