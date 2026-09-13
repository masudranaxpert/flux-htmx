# ADR 0004: Attribute expansion over prefix aliasing

Status: Accepted
Date: 2026-07-28

## Context

Phase 1 set `htmx.config.prefix = "fx-"`. HTMX 4 reads its attributes through a configurable
prefix and accepts both `hx-foo` and `{prefix}foo`, so this made `fx-get`, `fx-target`, etc.
work as direct aliases with no code.

This created two problems:

1. **Namespace collapse.** With the prefix set to `fx-`, the canonical `hx-*` form and Flux
   shorthand became the same namespace. The clean separation that Flux wants —
   `fx-*` = shorthand, `hx-*` = raw escape hatch — was lost.

2. **Ambiguous precedence.** There was no rule for what happens when an element carries both
   `fx-get` and `hx-get`, because they resolved to the same attribute.

## Decision

Do not change HTMX's prefix. Leave it at the default (`data-hx-`) and instead **expand**
`fx-*` into `hx-*` at processing time in a `htmx:before:process` listener.

Precedence: **raw `hx-*` wins.** If an element already declares the target HTMX attribute,
Flux leaves it untouched. Expansion is therefore inherently idempotent — a second pass sees
the attribute present and skips.

## Consequences

- `fx-*` and `hx-*` are distinct namespaces and can be mixed freely.
- The raw HTMX escape hatch is unconditional and never silently overwritten.
- Expansion is a small amount of code (one module), but it is explicit and testable.
- The full HTMX 4 attribute surface is available through `fx-*` only where Flux declares a
  mapping; undocumented HTMX attributes are still reachable via raw `hx-*`.

## Verification

Browser tests in `test/e2e/flux.e2e.ts` prove, in real Chromium with real HTMX 4:

- `fx-get` on initial DOM is expanded and performs a request;
- raw `hx-get` works and is left intact;
- mixed `fx-get` + `hx-target` expands the verb while preserving the raw target;
- swapped content's `fx-*` is processed;
- repeated `Flux.process()` fires exactly one request per click (no duplicate handlers).
