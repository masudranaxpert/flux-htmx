---
title: CSRF
---

# CSRF protection

Flux reads your CSRF token once and attaches it to every mutating request (POST, PUT,
PATCH, DELETE) — retries included.

## Meta strategy (default for server-rendered apps)

```html
<meta name="csrf-token" content="KbyUmhTl…" />
<meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
```

| Option       | Default        | Description                     |
| ------------ | -------------- | ------------------------------- |
| `headerName` | `X-CSRF-Token` | Header the token is sent in     |
| `metaName`   | `csrf-token`   | Meta tag to read the token from |

## Framework recipes

=== "Django"

    Django expects `X-CSRFToken`:

    ```html
    <meta name="csrf-token" content="{% csrf_token %}" />
    <meta name="flux-config"
          content='{"csrf":{"strategy":"meta","headerName":"X-CSRFToken"}}' />
    ```

=== "Flask / FastAPI"

    ```html
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
    ```

    FastAPI: check the token in a dependency and read the `X-CSRF-Token` header.

=== "Go (net/http)"

    ```html
    <meta name="csrf-token" content="{{ .CsrfToken }}" />
    <meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
    ```

## Safe methods are token-free

GET requests never receive the token (matching real htmx/server semantics). Mutating
requests always do — including **retries**, which preserve the original request
headers via Flux's header normalizer. A `Headers` instance in the htmx request
context is handled correctly; it will never silently spread into an empty object.

## Runtime reconfiguration

```js
Flux.reconfigure({ csrf: { strategy: 'meta', headerName: 'X-CSRF-Token' } });
```
