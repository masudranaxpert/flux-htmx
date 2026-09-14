---
title: UI Components & Plugins
---

# UI Components & Plugins

Declarative UI components included in the full bundle and as opt-in plugins in modular builds.
No dependencies, fully accessible with WAI-ARIA roles, attributes, and keyboard navigation.

## Tabs (`fx-tabs`, `fx-tab`, `fx-panel`)

```html
<div fx-tabs>
  <nav role="tablist">
    <button fx-tab="overview">Overview</button>
    <button fx-tab="specs">Specifications</button>
    <button fx-tab="reviews">Reviews</button>
  </nav>

  <div fx-panel="overview">Overview contents...</div>
  <div fx-panel="specs">Technical specifications...</div>
  <div fx-panel="reviews">Customer reviews...</div>
</div>
```

- **`fx-tabs`**: Declares a tab container.
- **`fx-tab="id"`**: Marks a tab button. Automatically manages `aria-selected` and `tabindex`.
- **`fx-panel="id"`**: Marks the associated content panel. Automatically toggles the `hidden` attribute.
- **Keyboard navigation**: Left/Right arrow keys cycle between tabs and automatically switch panels and focus.

## Accordion & Disclosures (`fx-accordion`, `fx-disclosure`)

```html
<!-- Single disclosure -->
<div fx-disclosure>
  <button fx-disclosure-trigger>System Requirements</button>
  <div fx-disclosure-panel>Details about OS, RAM, and CPU...</div>
</div>

<!-- Multi-item accordion -->
<div fx-accordion>
  <div fx-disclosure>
    <button fx-disclosure-trigger>What is Flux?</button>
    <div fx-disclosure-panel>A thin server-driven frontend layer on HTMX 4.</div>
  </div>
  <div fx-disclosure>
    <button fx-disclosure-trigger>Do I need a build step?</button>
    <div fx-disclosure-panel>No build step is required!</div>
  </div>
</div>
```

- **`fx-disclosure`**: Wraps a collapsible item. State is tracked on `data-fx-open`.
- **`fx-disclosure-trigger`**: Toggles the disclosure panel and updates `aria-expanded`.
- **`fx-disclosure-panel`**: The collapsible body (toggled with the `hidden` class).
- **`fx-accordion`**: Groups disclosures into an accordion.

## Drawers (`fx-drawer`)

```html
<button fx-open="#nav-drawer">Menu</button>

<dialog id="nav-drawer" fx-drawer>
  <h2>Navigation</h2>
  <nav>...</nav>
  <button fx-close>Close</button>
</dialog>
```

- **`fx-drawer`**: Native `<dialog>` configured as a slide-over panel.
- Closes automatically on backdrop click and on ++escape++.
- Managed by the core dialog controller alongside `fx-modal`.

## Table Select-All (`fx-select-all`, `fx-table`)

```html
<table fx-table>
  <thead>
    <tr>
      <th><input type="checkbox" fx-select-all /></th>
      <th>Name</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><input type="checkbox" fx-select name="id" value="1" /></td>
      <td>Alpha</td>
    </tr>
    <tr>
      <td><input type="checkbox" fx-select name="id" value="2" /></td>
      <td>Beta</td>
    </tr>
  </tbody>
</table>
```

- **`fx-select-all`** (or `data-flux-select-all`): Checkbox that selects/deselects all row checkboxes in one batch update and dispatches a single change event.
- **`fx-select`**: Marks individual selectable checkboxes.
- **`fx-table`**: Table container holding selectable rows.

## Lightweight State (`fx-state`, `fx-state-toggle`, `fx-state-set`)

For simple client-side toggles without full reactive frameworks:

```html
<div fx-state>
  <button fx-state-toggle="active">Toggle Active</button>
  <button fx-state-set="view:grid">Grid View</button>
  <button fx-state-set="view:list">List View</button>

  <div fx-bind-active="true:bg-blue-500" fx-bind-view="grid:grid-layout">
    Content adjusts class based on state
  </div>
</div>
```

- **`fx-state`**: Scopes state key-value pairs.
- **`fx-state-toggle="key"`**: Toggles a boolean state (`"true"` / `"false"`).
- **`fx-state-set="key:value"`**: Sets a specific state value.
- **`fx-bind-[key]="value:class"`**: Conditionally applies a CSS class when `key === value`.

## Custom Toast Region (`fx-toast-region`)

```html
<div id="custom-toasts" fx-toast-region></div>
```

- **`fx-toast-region`**: Mounts the accessible toast notification container at a custom DOM location rather than the default bottom-right screen position.
