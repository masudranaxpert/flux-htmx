# FastAPI + Jinja example

A thin FastAPI integration showing fragment responses, form validation, ETag, and cache
headers. Reference for the Flux attributes a FastAPI endpoint pairs with.

## app.py

```python
from hashlib import md5
from fastapi import FastAPI, Form, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="templates")


def is_htmx(request: Request) -> bool:
    # HTMX 4 sends HX-Request: true (verify against installed version).
    return request.headers.get("HX-Request") == "true"


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/users", response_class=HTMLResponse)
async def users_partial(request: Request):
    users = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    body = templates.get_template("partials/users.html").render(
        {"request": request, "users": users}
    )
    resp = HTMLResponse(body)
    # Public GET fragment: HTTP caching complements Flux's fx-cache.
    resp.headers["Cache-Control"] = "public, max-age=60"
    resp.headers["ETag"] = f'"{md5(body.encode()).hexdigest()}"'
    return resp


@app.post("/users", response_class=HTMLResponse)
async def create_user(request: Request, email: str = Form(...)):
    if "@" not in email:
        # 422 routes the response to the fx-on-422 target.
        body = templates.get_template("partials/form_errors.html").render(
            {"errors": {"email": "Invalid email"}}
        )
        return HTMLResponse(body, status_code=422)
    # Success: 201 swaps the users list.
    users = [{"id": 1, "name": "Alice"}, {"id": 2, "name": email}]
    body = templates.get_template("partials/users.html").render({"users": users})
    return HTMLResponse(body, status_code=201)
```

## CSRF (optional)

FastAPI has no built-in CSRF. Use a middleware that sets a `csrftoken` cookie and validates
the `X-CSRFToken` header on mutations, then wire Flux via:

```html
<meta
  name="flux-config"
  content='{"flux":{"csrf":{"strategy":"cookie","cookieName":"csrftoken","headerName":"X-CSRFToken"}}}'
/>
```

## Template

```html
<form fx-post="/users" fx-target="#users" fx-on-422="#form-errors">
  <input name="email" />
  <button class="flux-btn flux-btn--primary">Create</button>
</form>
<div id="form-errors" role="alert"></div>
<div id="users"></div>
```
