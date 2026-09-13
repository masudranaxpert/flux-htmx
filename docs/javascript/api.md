---
title: Flux global API
---

# The `Flux` global API

Everything below is on `window.Flux` (CDN builds) or the module default export
(bundlers).

## Lifecycle

```js
Flux.isStarted();                    // boolean
Flux.config();                       // resolved config or null
Flux.start(element?, config?);       // configure + process
Flux.reconfigure(config?, root?);    // dispose + configure + process
Flux.process(element?);              // expand presets + htmx.process
Flux.dispose(options?);              // tear everything down
```

`dispose()` removes every Flux listener, runs all plugin teardowns, clears the cache
(keep it with `{ clearCache: false }`) and resets the runtime. A following `start()`
is a clean first boot — nothing stacks.

## Registration

```js
Flux.registerAction('highlight', (target, source) => { … });
Flux.use(myPlugin);        // register a plugin
Flux.unuse('my-plugin');   // remove it again
```

## Cache

```js
Flux.cache.get('GET:/stats');
Flux.cache.set('GET:/stats', '<div>…</div>');
Flux.cache.invalidate('/users/*');  // wildcard
Flux.cache.clear();
```

## Diagnostics

```js
Flux.doctor();                        // whole-page health report
Flux.inspect(element);                // per-element view: presets, conflicts, status rules
```

`doctor()` reports the detected htmx version, registered presets/plugins, elements
with conflicts, and configuration problems. Use it when something "just doesn't
fire".

## bootstrapFlux — explicit boot (modular)

```js
import { bootstrapFlux } from 'flux-htmx';

const api = bootstrapFlux({
  start: false,        // don't auto-process; call api.start() yourself
  config: { csrf: { strategy: 'meta' } },
});
```

`bootstrapFlux()` owns the `window.Flux` slot: it applies the duplicate-load policy
(`reuse` | `warn` | `error`) and honours `<meta name="flux-config" … autoStart>`.
Importing the module alone has **no global side effects**.

## Version & dependencies

```js
Flux.version;            // "2.1.0"
Flux.dependencies;       // { htmx: "4.0.0-beta6", … }
```
