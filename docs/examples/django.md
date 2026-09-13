---
title: Django
---

# Django + flux-htmx

## Setup

```html
<!-- base.html -->
<meta name="csrf-token" content="{% csrf_token %}" />
<meta name="flux-config" content='{"csrf":{"strategy":"meta","headerName":"X-CSRFToken"}}' />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.min.css" />
<script src="https://cdn.jsdelivr.net/npm/flux-htmx@2/dist/flux.full.iife.js" defer></script>
```

## A delete button

```python
# views.py
from django.views.decorators.http import require_POST

@require_POST
def item_delete(request, pk):
    Item.objects.filter(pk=pk, owner=request.user).delete()
    return HttpResponse(status=200)
```

```html
<button
  fx-delete="{% url 'item-delete' item.pk %}"
  fx-confirm="Delete?"
  fx-toast
  fx-success="Deleted"
  fx-remove-target="closest tr"
>
  Delete
</button>
```

## Search with partials

```python
def search(request):
    q = request.GET.get("q", "")
    return render(request, "partials/results.html", {"items": Item.objects.filter(name__icontains=q)})
```

```html
<input fx-search="{% url 'search' %}" fx-target="#results" hx-trigger="input changed delay:300ms" />
<div id="results">{% include "partials/results.html" %}</div>
```

!!! tip "CSRF"

    Django's `X-CSRFToken` header mapping is shown above — that's the whole
    integration. See the [CSRF guide](../guides/csrf.md).

Runnable app: [`examples/django/`](https://github.com/masudranaxpert/flux-htmx/tree/master/examples/django)
