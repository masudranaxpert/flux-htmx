---
title: Plugin system
---

# Plugin system

Flux's plugin API is the same one its own UI plugins use.

## Writing a plugin

```js
/** @param {import('flux-htmx').FluxPluginApi} api */
export function myPlugin(api) {
  const unregister = api.registerPreset('fx-highlight', {
    attribute: 'fx-highlight',
    connect(el) {
      const handler = () => el.classList.toggle('highlight');
      el.addEventListener('click', handler);
      return () => el.removeEventListener('click', handler); // disconnect
    },
  });

  api.registerAction('flash', (target, source) => {
    source.animate([{ opacity: 0 }, { opacity: 1 }], 300);
  });

  return () => {
    unregister();
  };
}
```

```js
Flux.use(myPlugin);
Flux.unuse('my-plugin');
```

## The plugin API

| Member | Description |
| --- | --- |
| `registerPreset(name, def)` | Register a preset attribute with `connect(el)` returning a disconnect |
| `registerAction(name, handler)` | Add an action usable in `fx-on-success` pipelines |
| `setGeneratedAttribute(el, name, value)` | Write an `hx-*` attribute owned by Flux |
| `safeQuery(selector, root?)` | Query that never throws on invalid selectors |
| `log` | Structured logger (`log.info/warn/error`) |

## Contract

- `connect()` **must** return a disconnect function — `Flux.dispose()` calls every
  disconnect; nothing stacks across restarts.
- Registering the same plugin twice throws (`usePlugin` duplicate check) — design
  installers to be idempotent or guarded.
- UI plugins (`installTabs`, `installState`, …) are plain functions returning
  teardowns; the full bundle's `dispose()` runs them all.
