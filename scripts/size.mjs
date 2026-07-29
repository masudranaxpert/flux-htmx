// Honest bundle-size report: raw, gzip, and which dependencies are bundled per output.
import { readFile } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const gzipAsync = promisify(gzip);
const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

const FILES = [
  { name: 'flux.js', bundled: 'Flux only (HTMX external)' },
  { name: 'flux.iife.js', bundled: 'Flux only (HTMX external)' },
  { name: 'flux.full.js', bundled: 'HTMX + Flux' },
  { name: 'flux.full.iife.js', bundled: 'HTMX + Flux' },
  { name: 'flux.css', bundled: 'styles' },
  { name: 'flux.min.css', bundled: 'styles (minified)' },
];

let anyMissing = false;
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
  } catch {
    anyMissing = true;
    rows.push({ file: f.name, raw: '— (not built)', gzip: '—', bundled: f.bundled });
  }
}

process.stdout.write('\nFlux bundle-size report\n========================\n');
for (const r of rows) {
  if (typeof r.raw === 'number') {
    process.stdout.write(
      `${r.file.padEnd(22)} raw ${(r.raw / 1024).toFixed(2)}kB  gzip ${(r.gzip / 1024).toFixed(2)}kB  [${r.bundled}]\n`,
    );
  } else {
    process.stdout.write(`${r.file.padEnd(22)} ${r.raw}  [${r.bundled}]\n`);
  }
}
if (anyMissing) process.stdout.write('\nSome outputs are missing — run `npm run build` first.\n');
