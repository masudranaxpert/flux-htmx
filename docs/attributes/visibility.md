---
title: Visibility
---

# Visibility layer

A small, honest set of show/hide primitives so a toggle doesn't require pulling in a
separate library. Every action is declarative, eval-free, CSP-compliant, and defaults
to `click`.

One mechanism drives them all: **the `hidden` class**. It is synchronous,
Tailwind-compatible and composable — a panel hidden by `fx-hide` is shown again by
`fx-show` or `fx-toggle`. No inline-style fights, no orphan opacity.

## Actions

```html
<!-- Shows #sidebar on click (removes .hidden) -->
<button fx-show="#sidebar">Open</button>

<!-- Hides #sidebar on click (adds .hidden) -->
<button fx-hide="#sidebar">Close</button>

<!-- Toggles .hidden on click -->
<button fx-toggle="#sidebar">Toggle Menu</button>

<!-- Toggles a class on click (targets self by default) -->
<div fx-class="bg-blue-500">Toggle My Color</div>

<!-- Toggles a class on a specific target -->
<button fx-class="translate-x-full" fx-target=".circle">Toggle Circle</button>

<!-- Removes ITSELF after 3 seconds (value must be a duration) -->
<div fx-remove="3s">Item Saved Successfully!</div>
```

## Dropdowns — fx-dropdown

```html
<button fx-dropdown="#menu">Toggle</button>

<ul id="menu" class="hidden">
  <li><a href="/profile">Profile</a></li>
  <li><a href="/settings">Settings</a></li>
</ul>
```

One handler coordinates everything: the trigger toggles the menu, clicking outside
the trigger/menu closes it, ++escape++ closes it, and the trigger's `aria-expanded`
stays in sync. The click that opens the menu can never immediately close it.

## Modals & Drawers — canonical path

```html
<button fx-open="#edit">Edit</button>

<dialog id="edit" fx-modal>
  <form method="dialog">...</form>
  <button fx-close>Cancel</button>
</dialog>

<!-- Slide-over drawer panel -->
<button fx-open="#side-drawer">Settings</button>

<dialog id="side-drawer" fx-drawer>
  <h2>Settings</h2>
  <button fx-close>Close</button>
</dialog>
```

`<dialog>` + `fx-open` / `fx-close` is the **canonical modal and drawer path**: focus trap and
restoration are native, and `fx-modal` / `fx-drawer` close on backdrop click (available in both
the core and full bundles — the logic lives in the core dialog controller). `fx-drawer` shares
the same backdrop-dismiss behavior and represents slide-over side panels.
A `fx-open` target must be a `<dialog>` or declare the `popover` attribute; anything
else logs a warning instead of throwing.

## Dismissable overlays (legacy div pattern)

```html
<div id="my-modal" class="hidden">
  <div class="modal-content" fx-hide-outside="#my-modal" fx-hide-escape="#my-modal">
    <h2>Hello Modal</h2>
    <button fx-hide="#my-modal">Close</button>
  </div>
</div>
```

- `fx-hide-outside="#id"` — hide the target when a click lands outside the content box
- `fx-hide-escape="#id"` — hide the target on ++escape++

The two attributes do not conflict with each other or with `fx-show`/`fx-hide` on the
same elements — conflict detection only flags genuinely contradictory pairs.

!!! warning "Define the `hidden` class"

    Every visibility action drives the `hidden` class. With Tailwind you already have
    it; otherwise load `flux.css` (which ships `.hidden{display:none!important}`).
    Without a definition, hide actions would silently no-op — Flux warns in the
    console the first time it detects that.

## Disconnection contract

Re-processing an element (htmx swaps, `Flux.process()`) replaces the previous
listener instead of stacking: signature changes disconnect the old registration. A
`fx-toggle` keeps toggling correctly no matter how many times its markup is
re-rendered.
