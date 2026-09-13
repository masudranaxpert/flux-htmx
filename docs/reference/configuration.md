---
title: Configuration
---

# Configuration reference

Configure Flux with a meta tag (read before boot) or at runtime with
`Flux.reconfigure()`.

```html
<meta
  name="flux-config"
  content='{
  "csrf":      { "strategy": "meta", "headerName": "X-CSRFToken", "metaName": "csrf-token" },
  "requests":  { "timeoutMs": 15000, "credentials": "same-origin" },
  "retry":     { "maxRetries": 2, "baseDelayMs": 500, "maxDelayMs": 8000 },
  "feedback":  { "indicator": "#global-spinner" },
  "htmx":      { "defaultSwap": "innerHTML" },
  "dependencies": { "duplicatePolicy": "warn" },
  "autoStart": true
}'
/>
```

## Schema

### csrf

| Key          | Default        | Description                           |
| ------------ | -------------- | ------------------------------------- |
| `strategy`   | `"meta"`       | Where the token comes from (`meta`)   |
| `headerName` | `X-CSRF-Token` | Header to attach on mutating requests |
| `metaName`   | `csrf-token`   | Meta tag to read                      |

### requests

| Key           | Default            | Description                                              |
| ------------- | ------------------ | -------------------------------------------------------- |
| `timeoutMs`   | `0` (htmx default) | Request timeout; combined with any existing abort signal |
| `credentials` | `"same-origin"`    | Fetch credentials mode                                   |

### retry

| Key           | Default | Description                  |
| ------------- | ------- | ---------------------------- |
| `maxRetries`  | `2`     | Attempts after first failure |
| `baseDelayMs` | `500`   | Exponential backoff base     |
| `maxDelayMs`  | `8000`  | Backoff ceiling              |

### feedback

| Key         | Default | Description                       |
| ----------- | ------- | --------------------------------- |
| `indicator` | —       | Global indicator element selector |

### htmx

| Key           | Default       | Description                       |
| ------------- | ------------- | --------------------------------- |
| `defaultSwap` | `"innerHTML"` | Installed as htmx's `defaultSwap` |

### dependencies

| Key               | Default  | Description                                                   |
| ----------------- | -------- | ------------------------------------------------------------- |
| `duplicatePolicy` | `"warn"` | `reuse` \| `warn` \| `error` when Flux/htmx is already loaded |

### autoStart

| Key         | Default | Description                                             |
| ----------- | ------- | ------------------------------------------------------- |
| `autoStart` | `true`  | CDN builds: process the document immediately after boot |

## Runtime reconfiguration

```js
Flux.reconfigure({ requests: { timeoutMs: 5000 } });
```

`reconfigure()` disposes the runtime (preserving the cache), applies the merged
config and reprocesses the document.
