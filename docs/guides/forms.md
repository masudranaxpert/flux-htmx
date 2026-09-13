---
title: Forms
---

# Forms guide

Everything form-related in one place: submission, validation, confirmation, dirty
tracking, autosave and persistence.

## Submission

```html
<form fx-submit="/users" fx-validate fx-reset fx-indicator="#spin">
  <input name="email" type="email" required />
  <button>Save</button>
</form>
```

On submit, Flux runs the htmx pipeline with your CSRF token attached. After success
you can reset (`fx-reset`), invalidate caches (`fx-invalidate="/users/*"`), show a
toast (`fx-toast`) or run action pipelines (`fx-on-success`, see below).

## Validation — fx-validate

```html
<form fx-submit="/signup" fx-validate fx-focus-error>
  <input name="email" type="email" required />
  <input name="username" minlength="3" required />
  <button>Create account</button>
</form>
```

`fx-validate` runs the browser's constraint validation first. An invalid form
**short-circuits the whole pipeline**: no request, no confirm dialog, no toast — the
browser shows its native validation UI. `fx-focus-error` focuses the first invalid
field.

## Confirmation

=== "Native confirm"

    ```html
    <button fx-delete="/item/1" fx-confirm="Delete this item?">Delete</button>
    ```

=== "Custom dialog"

    ```html
    <button fx-delete="/item/1" fx-confirm-dialog="#confirm">Delete</button>

    <dialog id="confirm">
      <p>Delete this item?</p>
      <button data-flux-confirm="1">Yes</button>
      <button onclick="this.closest('dialog').close()">No</button>
    </dialog>
    ```

The custom dialog controller wires itself to `htmx:confirm`: `showModal()` on
request, resume on the `[data-flux-confirm]` click, dismiss otherwise. Validation
failure suppresses the dialog entirely — invalid forms can never confirm-confirm
their way into a request.

## Action pipelines — fx-on-success / fx-on-error

Declarative post-request actions, executed in order:

```html
<form fx-submit="/users"
      fx-on-success="toast:User saved; reset; refresh:#user-list"
      fx-on-error="toast:Save failed">
```

Built-in actions: `close` (close dialog), `open` (open dialog), `reset` (reset form),
`refresh` (htmx-trigger a re-request of a target), `remove` (remove an element),
`toast` (show a message). Register your own with
[`Flux.registerAction`](../javascript/api.md).

## Dirty tracking — fx-dirty

```html
<form fx-dirty fx-submit="/draft">
  <input name="title" />
  <button type="submit" disabled>Save</button>
</form>
```

Inputs get `data-dirty="true"` when their value differs from the initial one; the
form gets `data-dirty` when any input is dirty; the submit button stays disabled
until the form is dirty (or `fx-disable-clean` re-disables the clean state).

## Autosave — fx-autosave

```html
<form fx-autosave="/draft" hx-trigger="change delay:1s">…</form>
```

Debounced save on change. Pair with `fx-dirty` to show unsaved state.

## Field persistence — fx-persist

```html
<input fx-persist="search-q" name="q" />
```

The value survives reloads via `localStorage` under `fx-persist:<key>`. Restoration
dispatches `flux:persist:restored` (bubbling) — **not** a synthetic `change`, so
autosave/triggers don't fire unintended requests on page load.

## Password toggle

```html
<input type="password" id="pw" />
<button fx-password-toggle="pw" aria-pressed="false">Show</button>
```

Toggles `type` between `password` and `text` and mirrors state in `aria-pressed`.

## Tables — bulk updates

```html
<table fx-table>
  <thead><tr><th><input type="checkbox" data-flux-select-all /></th>…</tr></thead>
  <tbody>
    <tr><td><input type="checkbox" name="id" value="1" /></td><td>…</td></tr>
  </tbody>
</table>
```

The select-all checkbox updates every row checkbox in **one pass** and emits a single
`change` — no 100-request accident on a 100-row table.
