# Go html/template example

A thin Go integration using only the standard library: fragment rendering, request
detection, delete, CSRF pattern, and cache headers.

## main.go

```go
package main

import (
	"crypto/subtle"
	"fmt"
	"html/template"
	"net/http"
)

var tmpl = template.Must(template.ParseGlob("templates/*.html"))

func isHTMX(r *http.Request) bool {
	// HTMX 4 sends HX-Request: true (verify against installed version).
	return r.Header.Get("HX-Request") == "true"
}

func main() {
	http.HandleFunc("/", dashboard)
	http.HandleFunc("/users", users)
	http.HandleFunc("/users/delete", deleteUser)
	http.ListenAndServe(":8080", nil)
}

func dashboard(w http.ResponseWriter, r *http.Request) {
	tmpl.ExecuteTemplate(w, "dashboard.html", nil)
}

func users(w http.ResponseWriter, r *http.Request) {
	users := []map[string]any{
		{"ID": 1, "Name": "Alice"},
		{"ID": 2, "Name": "Bob"},
	}
	// Cacheable public GET fragment.
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.ExecuteTemplate(w, "users.html", users)
}

func deleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// CSRF: validate a same-site cookie against the header (constant-time compare).
	cookie, err := r.Cookie("csrftoken")
	if err != nil || subtle.ConstantTimeCompare(
		[]byte(cookie.Value), []byte(r.Header.Get("X-CSRFToken")),
	) != 1 {
		http.Error(w, "invalid csrf token", http.StatusForbidden)
		return
	}
	// Success: 200 with empty body; fx-swap="delete" removes the closest tr.
	w.WriteHeader(http.StatusOK)
}
```

## template: users.html

```html
{{range .}}
<tr>
  <td>{{.Name}}</td>
  <td>
    <button
      class="flux-btn"
      fx-delete="/users/delete?id={{.ID}}"
      fx-target="closest tr"
      fx-swap="delete"
      fx-confirm="Delete {{.Name}}?"
    >
      Delete
    </button>
  </td>
</tr>
{{end}}
```

## Notes

- Request detection (`HX-Request`) must be verified against the installed HTMX 4 version.
- CSRF here is a manual cookie+header check wired to Flux's `strategy: "cookie"` config;
  Flux only attaches the token to same-origin mutations.
