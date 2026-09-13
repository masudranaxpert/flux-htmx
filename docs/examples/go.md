---
title: Go
---

# Go + flux-htmx

## Setup

```html
<meta name="csrf-token" content="{{.CsrfToken}}" />
<meta name="flux-config" content='{"csrf":{"strategy":"meta"}}' />
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js" defer></script>
```

## Fragment handler

```go
func searchHandler(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query().Get("q")
    rows := db.Search(q)
    tmpl.ExecuteTemplate(w, "rows", rows) // fragment only
}

func main() {
    http.HandleFunc("/search", searchHandler)
    http.ListenAndServe(":8080", nil)
}
```

```html
<input fx-search="/search" fx-target="#results" hx-trigger="input changed delay:300ms" />
<div id="results">{{template "rows" .}}</div>
```

## Polling dashboard

```html
<div fx-poll="/stats" hx-trigger="every 5s" hx-target="this">{{template "stats" .}}</div>
```

Runnable app: [`examples/go/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/go)
