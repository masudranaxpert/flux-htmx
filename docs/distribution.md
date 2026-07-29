# Distribution

Flux ships as pre-built distribution bundles plus an npm package. Pick the build that matches how
you load scripts. All builds expose the same `fx-*` attributes and the same global `window.Flux` object.

## Distribution Builds

| File                | Format | Bundles                | Description & Primary Use Case                                   |
| ------------------- | ------ | ---------------------- | ---------------------------------------------------------------- |
| `flux.full.iife.js` | IIFE   | Flux + HTMX 4 | All-in-One Standalone script tag (Django, Laravel, Go, Rails)    |
| `flux.iife.js`      | IIFE   | Flux core only         | Use when HTMX 4 is pre-loaded via separate script tags |
| `flux.full.js`      | ESM    | Flux + HTMX 4 | Standalone ES Module bundle                                      |
| `flux.js`           | ESM    | Flux core only         | Use with Vite, Webpack, etc. (import htmx separately)            |
| `flux.css`          | CSS    | —                      | Styling & accessible live region                                 |
| `flux.min.css`      | CSS    | —                      | Minified stylesheet for production                               |

## Global `window.Flux` API & Diagnostics

All browser builds expose a global `window.Flux` object for browser debugging, runtime inspection, and diagnostic health checks:

```js
// Public Inspection Properties & Status
Flux.version; // string: "0.1.0-beta.0"
Flux.dependencies; // object: { htmx: "4.0.0-beta6" }
Flux.isStarted; // boolean: true / false
Flux.config; // object: active ResolvedConfig instance
Flux.cache; // FragmentCache instance
Flux.htmx; // exposed HTMX instance (standalone build)

// Core Methods
Flux.start(el); // Manually initialize Flux and process target element
Flux.configure(config); // Apply configuration (CSRF, cache, feedback, requests)
Flux.reconfigure(config); // Restarts runtime with updated configuration
Flux.process(el); // Reconcile, expand Flux attributes, and run HTMX processing
Flux.dispose(options); // Teardown event listeners, status handlers, and reset runtime state

// Plugin API
Flux.use(plugin); // Register and setup custom Flux plugin preset
Flux.unuse(name); // Unregister plugin and teardown custom presets

// Developer Diagnostics & Doctor
Flux.inspect(element); // Inspects element presets, generated attributes, and warnings
Flux.doctor(root); // Full document/subtree health check returning diagnostic report
```

## Developer Diagnostics (`inspect` & `doctor`)

Use `Flux.inspect(element)` to debug an individual element:

```js
const report = Flux.inspect(document.querySelector('form'));
console.log(report.presets); // ['fx-submit']
console.log(report.generatedAttributes); // { "hx-post": "/save" }
console.log(report.warnings); // []
```

Use `Flux.doctor()` to audit the entire document for configuration issues, missing dependencies, invalid CSS selectors, or empty URLs:

```js
const audit = Flux.doctor();
console.log(audit.htmxDetected); // true
console.log(audit.elementsInspected); // 24
console.log(audit.warnings); // []
```

## Startup & Deferring Auto-Start

By default, Flux auto-starts on document load. To defer startup (for example, to configure CSRF tokens or custom feedback selectors before processing):

```html
<meta name="flux-config" content='{"autoStart": false}' />
```

Then start manually when ready:

```js
Flux.configure({
  csrf: { cookieName: 'csrftoken', headerName: 'X-CSRFToken' },
});
Flux.start();
```

## Duplicate-Dependency Policy

If Flux or HTMX is loaded more than once (e.g. both standalone and inside `flux.full.iife.js`), Flux handles conflicts according to the `duplicatePolicy` option in `<meta name="flux-config">`:

```html
<meta name="flux-config" content='{"dependencies": {"duplicatePolicy": "reuse"}}' />
```

| Value   | Behavior                                                                                    |
| ------- | ------------------------------------------------------------------------------------------- |
| `reuse` | Reuse the already-loaded `Flux` instance; duplicate initialization returns existing global. |
| `warn`  | Reuse existing instance and log a warning to console. (Default)                             |
| `error` | Throw an explicit error on startup to prevent silent conflicts.                             |
