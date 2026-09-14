---
title: Admin widgets
---

# Admin widgets

Log viewer, clipboard, relative time, shortcuts, upload progress and an
unsaved-changes guard — all pure JavaScript, no extra CSS required.

## fx-log — auto-scroll log viewer

```html
<div id="deploy-log" fx-log="1000" style="height:300px;overflow:auto"></div>
```

Point an htmx request at it (`hx-target="#deploy-log" hx-swap="beforeend"`) and it
behaves like a deploy console:

- **pinned to the bottom** while you are at the bottom
- auto-scroll **pauses** the moment you scroll up (reading history)
- resumes as soon as you return to the bottom
- **line cap** (attribute value, default 1000) — old lines are removed so the DOM
  never grows unbounded

## fx-copy — clipboard

```html
<code id="api-key">sk-live-…</code> <button fx-copy="#api-key">Copy API key</button>
```

Copies the target's text (or input value), shows **"Copied!"** on the trigger for
1.5s (`data-flux-copied`), falls back to `execCommand` when the Clipboard API is
unavailable.

## fx-ago — relative time

```html
<time fx-ago datetime="2026-09-13T10:00:00Z"></time>
<!-- renders: 3 minutes ago -->
```

- uses `Intl.RelativeTimeFormat` (locale-aware: "vor 3 Minuten", "৩ মিনিট আগে")
- refreshes every minute **while the tab is visible** (no background churn)
- updates again after every htmx settle
- server sends ISO timestamps — timezone problems gone

## fx-shortcut — keyboard bindings

```html
<input fx-search="/search" fx-shortcut="/" />
<button fx-shortcut="ctrl+k">Palette</button>
<button fx-shortcut="escape" fx-close>Close</button>
```

Modifiers: `ctrl` (or `cmd`/`mod`), `shift`, `alt`. Matching key **clicks** the
element — composing with everything a click can do.


## Unsaved-changes guard

```html
<form fx-dirty fx-submit="/config">…</form>
```

When a dirty form has unsaved edits: `beforeunload` warns on tab close/refresh, and
htmx-boosted navigation away from the form asks for confirmation.
