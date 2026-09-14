---
title: Transitions
---

# Transitions

CSS animations and transitions triggered automatically when elements are added to the DOM via HTMX swaps.

The transitions plugin monitors element insertions and drives two-frame enter transitions, removing temporary transition classes once `transitionend` or `animationend` fires.

## Basic Usage (`fx-transition`)

```html
<div fx-transition>
  <p>Fresh content swapped in by HTMX!</p>
</div>
```

By default, applying `fx-transition` will add:

1. **Initial frame**: `fx-enter fx-enter-start`
2. **Next animation frame**: `fx-enter-start` is removed and `fx-enter-end` is added.
3. **On transition end**: `fx-enter` and `fx-enter-end` are cleaned up.

In CSS (or `flux.css`):

```css
.fx-enter {
  transition:
    opacity 300ms ease-out,
    transform 300ms ease-out;
}
.fx-enter-start {
  opacity: 0;
  transform: translateY(10px);
}
.fx-enter-end {
  opacity: 1;
  transform: translateY(0);
}
```

## Custom Transition Classes

You can customize the CSS classes used during the transition lifecycle:

```html
<div
  fx-transition
  fx-transition-enter="transition duration-300 ease-out"
  fx-transition-enter-start="opacity-0 scale-95"
  fx-transition-enter-end="opacity-100 scale-100"
>
  Tailwind-compatible transition
</div>
```

| Attribute                   | Default Class    | Description                                                          |
| --------------------------- | ---------------- | -------------------------------------------------------------------- |
| `fx-transition`             | —                | Activates enter animation when element (or descendants) are inserted |
| `fx-transition-enter`       | `fx-enter`       | Transition properties (e.g. `transition duration-300 ease-out`)      |
| `fx-transition-enter-start` | `fx-enter-start` | Starting state before animation begins (e.g. `opacity-0`)            |
| `fx-transition-enter-end`   | `fx-enter-end`   | Target state applied on the next frame (e.g. `opacity-100`)          |

## Short Aliases

The short class name aliases `fx-enter`, `fx-enter-start`, and `fx-enter-end` can be styled directly in your stylesheet without needing custom attribute values.
