# Security

Flux is a client-side attribute expander; it does not add a server, authentication, or
authorization. The notes below cover its security-relevant defaults and the boundaries that
remain the application's responsibility.

## Same-origin by default

All Flux/HTMX requests are same-origin unless an element opts in to a cross-origin URL. There
is no global opt-out of the same-origin default; cross-origin is per-element, explicit, and
uses the standard HTMX request attributes:

```html
<button fx-get="https://api.example.com/data" fx-target="#out">External</button>
```

Cross-origin requests follow the browser's normal CORS rules. Flux does not add credentials to
cross-origin requests; if credentials are required, set them via raw HTMX configuration or a
custom `htmx:config:request` handler.

## CSRF

Flux provides CSRF token handling for **same-origin mutations only** (`POST`, `PUT`, `PATCH`,
`DELETE`). GET requests never carry the token. The token is read from one of two sources,
selected by configuration:

- **Meta tag** — `<meta name="csrf-token" content="...">`.
- **Cookie** — a cookie set by the server, read and attached to the header.

The header name is configurable (default follows the application's convention; see the
feedback/security configuration in `src/flux.ts`). The token is attached only to mutation
requests and is never attached to cross-origin requests, so it is not leaked to third parties.
Tokens are never logged.

## CSP

Flux itself contains no `eval`, no `new Function`, and no dynamic string compilation. However,
one HTMX feature relies on HTMX's `allowEval`, which is on by default but blocked under a strict
CSP:

- `fx-trigger` with a value that includes a filter expression `[...]`.

(Note: `fx-search` and `fx-min-length` are fully native and do **not** require eval).

Under a strict CSP (`script-src` without `'unsafe-eval'`), custom trigger filters will not work. To work around this:

Write the trigger by hand using raw `hx-trigger` without filters, and enforce conditions on the server, or via a custom `htmx:beforeRequest` handler.

In either case, Flux never silently weakens CSP. If `allowEval` is disabled, the affected
triggers simply do not fire.

## No server trust assumed

Flux expands client-side attributes; the resulting requests are no more trustworthy than any
other client request. The server must:

- Validate and authorize every request independently of how it was triggered.
- Escape all interpolated data when rendering HTML fragments. Flux does not sanitise response
  bodies; output escaping remains a server-side responsibility.
- Treat every `fx-*` / `hx-*` attribute as untrusted user input. Never render attributes
  supplied by a client directly into server-generated HTML without allow-listing.

## Summary

| Concern                 | Flux behaviour                                             |
| ----------------------- | ---------------------------------------------------------- |
| Request origin          | Same-origin by default; cross-origin is per-element opt-in |
| CSRF token              | Same-origin mutations only; never sent cross-origin        |
| `eval` / `new Function` | None in Flux; only HTMX trigger filters need `allowEval`   |
| Strict CSP              | Supported; custom trigger filters drop back   |
| Response sanitisation   | Server responsibility; Flux does not escape bodies         |
