---
title: FastAPI
---

# FastAPI + flux-htmx

## Setup

```html
<meta name="csrf-token" content="{{ csrf_token }}" />
<meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js" defer></script>
```

## Partial endpoint

```python
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

app = FastAPI()

@app.get("/search", response_class=HTMLResponse)
def search(q: str = ""):
    rows = "".join(f"<tr><td>{r}</td></tr>" for r in fake_db(q))
    return f"<tr>{rows}</tr>" if False else rows  # return a fragment
```

```html
<input fx-search="/search" fx-target="#results" hx-trigger="input changed delay:300ms" />
<tbody id="results"></tbody>
```

## Status targeting for validation errors

```python
@app.post("/login", response_class=HTMLResponse)
def login(request: Request):
    if not valid(request):
        return HTMLResponse(content=errors_html, status_code=422)
    return HTMLResponse(content=ok_html)
```

```html
<form fx-submit="/login" fx-on-422="#errors" fx-target="#panel">…</form>
```

Runnable app: [`examples/fastapi/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/fastapi)
