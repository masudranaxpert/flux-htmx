// Attribute documentation coverage gate.
// Ensures every user-facing `fx-*` attribute declared in src/ is documented in README.md or docs/.
// Fails with exit code 1 if any attribute is undocumented.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, ext) {
  let files = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      files = files.concat(walk(p, ext));
    } else if (p.endsWith(ext)) {
      files.push(p);
    }
  }
  return files;
}

const docsText = ['README.md', ...walk('docs', '.md')]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const srcFiles = walk('src', '.ts');

const srcAttrs = new Set();
for (const file of srcFiles) {
  const code = readFileSync(file, 'utf8');
  // Match `fx-*` tokens that are not internal data-fx-* attributes
  const matches = code.matchAll(/(?<![a-zA-Z0-9_-])fx-[a-z0-9-]+/g);
  for (const m of matches) {
    srcAttrs.add(m[0]);
  }
}

const missing = [];
for (const attr of Array.from(srcAttrs).sort()) {
  if (!docsText.includes(attr)) {
    missing.push(attr);
  }
}

process.stdout.write(
  `\nFlux attribute documentation coverage report\n=============================================\n`,
);
process.stdout.write(`Total user-facing fx-* attributes in src: ${srcAttrs.size}\n`);

if (missing.length > 0) {
  process.stderr.write(
    `\nERROR: ${missing.length} attribute(s) declared in src/ are missing from documentation:\n`,
  );
  for (const attr of missing) {
    process.stderr.write(`  - ${attr}\n`);
  }
  process.stderr.write(`\nPlease document these attributes in docs/ before merging.\n`);
  process.exit(1);
}

process.stdout.write(`Documentation coverage: 100% (0 missing attributes)\n\n`);
