---
title: Examples
---

# Examples

Minimal but complete integration recipes. The repository also ships runnable apps:

| Stack | Path | What it shows |
| --- | --- | --- |
| Vanilla (Node) | [`examples/vanilla/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/vanilla) | search, poll, delete+toast, caching |
| Django | [`examples/django/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/django) | CSRF meta + header mapping, partials |
| FastAPI | [`examples/fastapi/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/fastapi) | Jinja partials, CSRF dependency |
| Go | [`examples/go/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/go) | html/template fragments |
| File monitor | [`examples/file-monitor/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/file-monitor) | SSE realtime + polling compared |

## The universal pattern

Every backend does the same three things:

1. Serve a page with the Flux script tag and CSRF meta.
2. Serve **fragments** (HTML partials) for each `hx-target`ed endpoint.
3. Return proper status codes — and let `fx-on-<code>` retarget errors client-side.

```html
<form fx-submit="/login" fx-on-401="#prompt" fx-on-422="#errors" fx-toast>…</form>
```

Pick your stack: [Django](django.md) · [FastAPI](fastapi.md) · [Go](go.md)
