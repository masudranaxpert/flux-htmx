// Ambient declarations for script-tag globals Flux integrates with.
export {};

declare global {
  // Set by the htmx <script> tag or by the full Flux bundle. The bundled
  // `htmx.org` import is preferred; this global is the fallback for CDN loads.
  var htmx: object | undefined;
}
