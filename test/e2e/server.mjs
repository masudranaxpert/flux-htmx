// Fixture HTTP server for browser tests. Serves a page that loads real htmx 4 + the Flux
// IIFE bundle, and returns HTML fragments for the fx-get / swap endpoints. Kept intentionally
// minimal — this is test scaffolding, not product code.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, relative, resolve as resolvePath, sep } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)));
const REPO = resolvePath(join(ROOT, '..', '..'));
const PUBLIC = join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
};

function mimeFor(absPath) {
  const ext = absPath.toLowerCase().match(/\.\w+$/)?.[0] ?? '';
  return MIME[ext] ?? 'text/plain';
}

async function sendFile(res, absPath) {
  const info = await stat(absPath);
  if (info.isDirectory()) {
    res.writeHead(403);
    res.end('directory');
    return;
  }
  const body = await readFile(absPath);
  res.writeHead(200, { 'Content-Type': mimeFor(absPath) });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;

    if (path === '/fragment/hello') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<p id="hello">Hello from server</p>');
      return;
    }
    if (path === '/fragment/swapped') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<button id="swapped-btn" fx-get="/fragment/hello" fx-target="#result2">Swap me</button>',
      );
      return;
    }

    let filePath;
    if (path === '/htmx.js') {
      filePath = join(REPO, 'node_modules', 'htmx.org', 'dist', 'htmx.min.js');
    } else if (path === '/flux.js') {
      filePath = join(REPO, 'dist', 'flux.iife.js');
    } else {
      // Map the URL under /public; "/" resolves to index.html.
      const rel = path === '/' ? 'index.html' : normalize(path);
      filePath = join(PUBLIC, rel);
    }

    const abs = resolvePath(filePath);
    const allowedRoots = [PUBLIC, join(REPO, 'dist'), join(REPO, 'node_modules')];
    // Containment check via path.relative: robust to platform separator differences.
    const inside = allowedRoots.some((r) => {
      const rel = relative(r, abs);
      return rel !== '' && !rel.startsWith('..' + sep) && !rel.startsWith('..' + '/');
    });
    if (!inside) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    await sendFile(res, abs);
  } catch (e) {
    res.writeHead(404);
    res.end(String(e?.message ?? 'not found'));
  }
});

const PORT = Number(process.env.FLUX_E2E_PORT ?? 4317);
server.listen(PORT);
process.stdout.write(`flux e2e server on http://localhost:${PORT}\n`);
