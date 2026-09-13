---
title: htmx 4 configuration
---

# htmx 4 configuration

## Via meta tag

```html
<meta name="htmx-config" content='{"implicitInheritance": true}' />
```

Flux's own meta tag is separate — `<meta name="flux-config">` (see
[configuration](../reference/configuration.md)). The two coexist.

## Key `htmx.config` settings (4.0)

| Setting               | Default       | Description                                                                                               |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `implicitInheritance` | `false`       | 4.0 made inheritance **explicit** (`hx-inherit`); set `true` for 2.x behaviour                            |
| `noSwap`              | `[204, 304]`  | Status codes that don't swap. 4.0 swaps 4xx/5xx by default — set `["4xx","5xx"]` to restore 2.x behaviour |
| `defaultSwap`         | `"innerHTML"` | Flux sets this from `flux-config.htmx.defaultSwap`                                                        |
| `historyEnabled`      | `true`        | 4.0 restores history by **re-requesting the page**, not a local snapshot                                  |
| `historyCacheSize`    | —             | Legacy snapshot cache (4.0 prefers `hx-history-cache` extension)                                          |
| `allowEval`           | `true`        | Set `false` for strict CSP (`hx-vals js:` etc. stop working)                                              |
| `allowScriptTags`     | `true`        | Execute `<script>` in swapped content                                                                     |
| `selfRequestsOnly`    | `true`        | Only allow requests to the same origin                                                                    |
| `scrollBehavior`      | `"smooth"`    | Scroll behaviour on `show:`/`scroll:` modifiers                                                           |
| `defaultFocusScroll`  | `false`       | Scroll focused element into view                                                                          |

## Runtime access

```js
htmx.config.defaultTimeout = 10000; // direct
Flux.reconfigure({ requests: { timeoutMs: 10000 } }); // Flux-managed equivalent
```

## Attributes worth knowing

| Attribute                           | Description                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `hx-inherit="true\|false"`          | Explicit attribute inheritance control (4.0 default: explicit) |
| `hx-disinherit="hx-target hx-swap"` | Block specific inherited attributes                            |
| `hx-history="false"`                | Exclude element from history                                   |
| `hx-ext` / `hx-vals` / `hx-params`  | See [core attributes](core-attributes.md)                      |
