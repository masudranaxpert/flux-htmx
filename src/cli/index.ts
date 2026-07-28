#!/usr/bin/env node
// flux-ui CLI. Built on Node stdlib only — no commander/yargs.
//
//   npx flux-ui init              scaffold a flux-config meta + static asset references
//   npx flux-ui add <component>   copy a component snippet
//   npx flux-ui doctor            scan HTML for common Flux/HTMX misconfigurations
//   npx flux-ui inspect <file>    show the HTMX expansion of fx-* attributes

import { cliMain } from './commands.js';

cliMain(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`flux-ui: ${e?.message ?? String(e)}\n`);
  process.exit(1);
});
