# Django example

A thin Django integration showing full-page + fragment rendering, CSRF, 422 validation,
delete-row, and cache headers. This is a reference for the Flux attributes a Django view
pairs with — not a full project scaffold.

## Setup (assets)

Build once, then copy into Django static. Production needs no Node.

```bash
npm run build
mkdir -p static/flux
cp dist/flux.full.iife.js dist/flux.css static/flux/
```

## Template: dashboard.html

```django
{% load static %}
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <!-- Configure Flux before htmx starts: Django CSRF cookie strategy. -->
  <meta name="flux-config" content='{
    "flux": {
      "csrf": {
        "strategy": "cookie",
        "cookieName": "csrftoken",
        "headerName": "X-CSRFToken"
      }
    }
  }'>
  <link rel="stylesheet" href="{% static 'flux/flux.css' %}">
  <script defer src="{% static 'flux/flux.full.iife.js' %}"></script>
</head>
<body>
  <button class="flux-btn" hx-get="{% url 'users_partial' %}" hx-target="#users">Load users</button>
  <div id="users"></div>

  <!-- POST form with validation routing to #form-errors on 422. -->
  <form hx-post="{% url 'user_create' %}" hx-target="#users" fx-on-422="#form-errors">
    {% csrf_token %}
    <input name="email" placeholder="email" />
    <button class="flux-btn flux-btn--primary" type="submit">Create</button>
  </form>
  <div id="form-errors" role="alert"></div>
</body>
</html>
```

## View: detect HTMX requests and render a partial

```python
def is_htmx_request(request):
    # HTMX 4 sends the HX-Request header (verify against your installed version).
    return request.headers.get("HX-Request") == "true"

def users_partial(request):
    users = User.objects.all()
    template = "partials/users.html" if is_htmx_request(request) else "dashboard.html"
    return render(request, template, {"users": users})

def user_create(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    form = UserForm(request.POST)
    if not form.is_valid():
        # 422 swaps the form-errors target via fx-on-422.
        return render(request, "partials/form_errors.html", {"errors": form.errors}, status=422)
    form.save()
    users = User.objects.all()
    # 201 is the success swap; fx-success on the form announces the toast.
    return render(request, "partials/users.html", {"users": users}, status=201)

def stats(request):
    # Cacheable public GET fragment: HTTP-level caching, complemented by Flux fx-cache.
    resp = render(request, "partials/stats.html", {"processed": processed_count()})
    resp["Cache-Control"] = "public, max-age=60"
    resp["ETag"] = f'"{processed_count()}"'
    return resp
```

## Delete row

```django
<tbody>
  {% for u in users %}
    <tr>
      <td>{{ u.name }}</td>
      <td>
        <button class="flux-btn"
                fx-delete="{% url 'user_delete' u.id %}"
                fx-target="closest tr"
                fx-swap="delete"
                fx-confirm="Delete {{ u.name }}?">
          Delete
        </button>
      </td>
    </tr>
  {% endfor %}
</tbody>
```

## Notes

- `HX-Request` header detection must be verified against the installed HTMX 4 version — see
  `docs/dependency-baseline.md` for the upgrade checklist.
- CSRF: Django's `csrftoken` cookie + `X-CSRFToken` header is wired via the `flux-config`
  meta; Flux attaches the token to same-origin mutations only.
