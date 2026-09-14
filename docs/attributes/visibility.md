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

### Dismissal Control (`closedby`)

Flux embraces the web standard `closedby` attribute (Chrome 134+, Firefox 137+, Safari 18.2+):

```html
<!-- Non-destructive modal / image preview: backdrop + Escape dismisses -->
<dialog id="preview" fx-modal closedby="any">...</dialog>

<!-- Form with inputs: Escape dismisses, backdrop click does NOT dismiss -->
<dialog id="edit-form" fx-modal closedby="closerequest">...</dialog>

<!-- Destructive action / mandatory choice: must click explicit button -->
<dialog id="delete-confirm" fx-modal closedby="none">...</dialog>
```

| `closedby` Value | Escape Key  | Backdrop Click | Primary Use Case                                                 |
| ---------------- | ----------- | -------------- | ---------------------------------------------------------------- |
| `any`            | Dismisses   | Dismisses      | Image previews, lightweight menus, read-only sheets              |
| `closerequest`   | Dismisses   | **Blocked**    | Forms with inputs, preventing accidental dismissals on misclicks |
| `none`           | **Blocked** | **Blocked**    | Critical/destructive confirmations, payments, required choices   |

In browsers supporting native `closedBy`, Flux delegates dismissal to the browser.
In older browsers, `fx-modal` polyfills `closedby="any"` light-dismiss while strictly honoring `closedby="none"` and `closedby="closerequest"`.

### Automatic Unsaved Changes Protection

If a `<dialog fx-modal>` contains a dirty form (`form[fx-dirty][data-dirty]`), Flux intercepts backdrop dismissal (and native `cancel` events) and prompts before closing.
The prompt message defaults to `"Discard unsaved changes?"`, which can be configured globally via `Flux.configure({ messages: { unsavedChanges: '...' } })` or overridden locally with `fx-dirty-message="Custom confirmation prompt"`. If the user cancels the confirmation, the modal remains open and form inputs are preserved.
!!! tip "Escape Key Handling"

    ++escape++ dismissal is handled natively by the `<dialog>` element (which fires the native `cancel` event).
    Use `closedby="none"` if you need to prevent Escape from closing the dialog.

!!! warning "Avoid `width: 100%; height: 100%` on dialogs"

    If a `<dialog>` is styled to cover 100% of the viewport width and height, backdrop clicks cannot land outside the element's bounding rectangle in fallback environments. Use `max-width`, `max-height`, or centered padding instead.

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
