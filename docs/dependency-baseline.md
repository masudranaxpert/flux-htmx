# Dependency baseline

Versions verified against the npm registry on 2026-07-28. Versions are pinned exactly in
`package.json`; do not trust this file alone — re-verify before any upgrade.

## Runtime peer dependency

| Package    | Version       | Tag    | Status                                         |
| ---------- | ------------- | ------ | ---------------------------------------------- |
| `htmx.org` | `4.0.0-beta6` | `next` | **Prerelease.** Stable is `2.0.10` (`latest`). |

HTMX 4 is still in beta. It is pinned to the exact tested version `4.0.0-beta6` — no caret
range, no broader prerelease range. HTMX integration lives in Flux's HTMX-coupled modules
(`src/expand.ts` depends on HTMX's `before:process` event semantics); the
[upgrade checklist](#upgrade-checklist) must be followed before moving to a newer beta or the
stable release.

## Development dependencies

| Package             | Version              | Notes                                                                                                                    |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `typescript`        | `5.9.3`              | `latest` is `7.0.2`, but no `typescript-eslint` release supports TS 7 yet (peer cap `<6.1.0`). Pinned to the latest 5.x. |
| `vite`              | `8.1.5`              | Uses the rolldown/`oxc` minifier; esbuild is no longer a dependency.                                                     |
| `vitest`            | `4.1.10`             | Unit tests in jsdom.                                                                                                     |
| `@playwright/test`  | `1.62.0`             | Browser integration tests in real Chromium.                                                                              |
| `eslint`            | `9.15.0`             | Flat config.                                                                                                             |
| `typescript-eslint` | `8.15.0`             |                                                                                                                          |
| `prettier`          | `3.4.2`              |                                                                                                                          |
| `jsdom`             | `25.0.1`             |                                                                                                                          |

## Node

Tested on Node `22.16.0`. The package declares `engines.node >= 20`.

## Upgrade checklist (HTMX 4)

Before adopting a newer HTMX 4 beta or the stable release:

1. Re-verify from the registry and pin the exact version.
2. Confirm the `htmx:before:process` event still fires on the processed root and bubbles to
   `document` before HTMX's element-discovery query. This is the assumption `src/lifecycle.ts`
   depends on.
3. Confirm the action selector still includes `[hx-get],[hx-post],[hx-put],[hx-patch],[hx-delete]`
   so Flux-expanded verbs are discovered.
4. Confirm `htmx:config:request` still exposes a mutable `detail.ctx.request` with `headers`,
   `method`, `action`, `timeout`, `credentials` (used by `src/flux.ts`).
5. Confirm `_htmx.initialized` still gates re-initialisation (the idempotency guarantee).
6. Re-run the browser suite (`npm run test:browser`) against the new build.
