---
title: Sugar (me / any)
---

# Sugar — `me()` and `any()`

Surreal-style DOM helpers for Locality of Behaviour: small inline `<script>` blocks
next to the markup they control.

```html
<button>
  Toggle Menu
  <script>
    me().on('click', () => {
      any('#menu').classToggle('hidden');
      me().classToggle('active');
    });
  </script>
</button>
```

## Selectors

- `me()` — the script's **parent element** (Locality of Behaviour)
- `me('#id')` — first match
- `me(event)` — the event's `currentTarget`
- `me('-')` — the script's **previous sibling**
- `any(selector, start?)` — all matches as an array

## Methods

Each is a **direct delegate of the native API** — no prototype patching, no node
cloning:

| Method                                      | Native equivalent                                |
| ------------------------------------------- | ------------------------------------------------ |
| `classAdd(n)` / `addClass(n)`               | `classList.add` (leading `.` stripped)           |
| `classRemove(n)` / `removeClass(n)`         | `classList.remove`                               |
| `classToggle(n, force?)` / `toggleClass(n)` | `classList.toggle`                               |
| `styles(str\|obj)`                          | `style.cssText +=` / `Object.assign(style, obj)` |
| `on(name, fn)` / `off(name, fn)`            | `addEventListener` / `removeEventListener`       |
| `attribute(name, value)` / `attr(...)`      | `getAttribute`/`setAttribute`/`removeAttribute`  |
| `disable()` / `enable()`                    | `el.disabled = true/false`                       |
| `send(name, detail)` / `trigger(...)`       | `dispatchEvent(new CustomEvent(...))`            |
| `fadeOut(fn?, ms?, removeEl?)`              | transition + cleanup                             |
| `fadeIn(fn?, ms?)`                          | transition + cleanup (restores prior styles)     |
| `remove()`                                  | `parentNode.removeChild(el)`                     |
| `run(fn)`                                   | call `fn(el)`, return element (chaining)         |

All methods return the element, so they chain:

```js
me('#toast')
  .classAdd('show')
  .on('transitionend', () => me('#toast').classRemove('show'));
```

## Global install

`Flux` installs `me`, `any`, `tick` and `sleep` on `window` and `document`
(never overwriting existing globals) when the runtime starts.
