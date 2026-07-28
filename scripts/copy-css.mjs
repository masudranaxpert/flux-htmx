// Copies the source stylesheet to dist as flux.css and a minified variant as flux.min.css.
// Minification is a simple whitespace/newline collapse — sufficient for this stylesheet size
// and avoids pulling in a CSS minifier dependency.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src', 'styles', 'flux.css');
const distDir = join(here, '..', 'dist');

const css = await readFile(src, 'utf8');
await mkdir(distDir, { recursive: true });

await writeFile(join(distDir, 'flux.css'), css, 'utf8');
const minified = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .trim();
await writeFile(join(distDir, 'flux.min.css'), minified, 'utf8');

process.stdout.write(`wrote flux.css (${css.length}B), flux.min.css (${minified.length}B)\n`);
