// Honest bundle-size report: raw, gzip, and which dependencies are bundled per output.
// Run with --check to fail on gzip budget regressions (used by CI as a size gate).
import { readFile } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const gzipAsync = promisify(gzip);
const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const check = process.argv.includes('--check');

// Gzip byte budgets. Bump a budget ONLY deliberately, in the PR that grows the
// bundle, with a note — never to silence a failure.
const BUDGETS_GZIP = {
  'flux.js': 26 * 1024,
  'flux.cjs': 24 * 1024,
  'flux.iife.js': 24 * 1024,
  'net.js': 4 * 1024,
  'net.iife.js': 4 * 1024,
  'flux.full.js': 44 * 1024,
  'flux.full.iife.js': 40 * 1024,
  'flux.css': 3 * 1024,
  'flux.min.css': 2 * 1024,
};

const FILES = [
  { name: 'flux.js', bundled: 'Flux core (HTMX external)' },
  { name: 'flux.cjs', bundled: 'Flux core, CJS (HTMX external)' },
  { name: 'flux.iife.js', bundled: 'Flux core, IIFE (HTMX external)' },
  { name: 'net.js', bundled: 'offline + upload + optimistic' },
  { name: 'net.iife.js', bundled: 'offline + upload + optimistic, IIFE' },
  { name: 'flux.full.js', bundled: 'HTMX + Flux + UI + net' },
  { name: 'flux.full.iife.js', bundled: 'HTMX + Flux + UI + net' },
  { name: 'flux.css', bundled: 'styles' },
  { name: 'flux.min.css', bundled: 'styles (minified)' },
];

let anyMissing = false;
let anyOver = false;
const rows = [];
for (const f of FILES) {
  try {
    const buf = await readFile(join(dist, f.name));
    const gz = await gzipAsync(buf);
    rows.push({
      file: f.name,
      raw: buf.length,
      gzip: gz.length,
      bundled: f.bundled,
    });
    if (gz.length > BUDGETS_GZIP[f.name]) anyOver = true;
  } catch {
    anyMissing = true;
    rows.push({ file: f.name, raw: '— (not built)', gzip: '—', bundled: f.bundled });
  }
}

process.stdout.write('\nFlux bundle-size report\n========================\n');
for (const r of rows) {
  if (typeof r.raw === 'number') {
    const budget = (BUDGETS_GZIP[r.file] / 1024).toFixed(0);
    const flag = r.gzip > BUDGETS_GZIP[r.file] ? '  << OVER BUDGET' : '';
    process.stdout.write(
      `${r.file.padEnd(22)} raw ${(r.raw / 1024).toFixed(2)}kB  gzip ${(r.gzip / 1024).toFixed(2)}kB / ${budget}kB  [${r.bundled}]${flag}\n`,
    );
  } else {
    process.stdout.write(`${r.file.padEnd(22)} ${r.raw}  [${r.bundled}]\n`);
  }
}
if (anyMissing) process.stdout.write('\nSome outputs are missing — run `npm run build` first.\n');
if (anyOver)
  process.stderr.write('\nBundle size budget exceeded. Bump budgets only deliberately.\n');
if (check && (anyOver || anyMissing)) process.exit(1);
