---
title: Security
---

# Security notes

## CSP

Flux never uses `eval`, `new Function` or inline-style hacks that require
`unsafe-inline` for scripts. All behaviour is declarative attributes + addEventListener
— safe under strict CSP.

## CSRF

- Token read once from the configured meta tag, attached to mutating requests only.
- Retries preserve the original headers (token included).
- GET requests stay token-free.

## Cache safety

- Sensitive parameter values (names containing `password`, `secret`, `token`, `auth`,
  `creditcard`, `cvv`) are **hashed into cache keys**, never stored verbatim.
- Only GET responses are cached; `fx-cache-mode="strict"` (default) enforces the
  conservative content-type policy.
- `fx-invalidate` after mutations prevents stale personal fragments.

## Offline queue caveat

`fx-offline` (optional net entry) stores plain request parameters in `localStorage`.
It does not preserve files, headers, or sensitive-field filtering — **do not use it
for sensitive or file-bearing requests**. See [offline guide](../guides/offline.md).

## Supply chain

- Zero runtime dependencies; htmx is a peer dependency.
- Published to npm with provenance from CI (`release.yml`), which runs the full unit +
  browser suite before publishing.
