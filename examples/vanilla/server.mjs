#!/usr/bin/env node
// Runnable vanilla example: a no-framework Node http server that serves a Flux page and
// HTML fragments. Demonstrates fx-get, fx-load, fx-search, and CSRF-cookie strategy.
// Run: node examples/vanilla/server.mjs  → http://localhost:4319
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const PORT = 4319;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Fragment endpoints.
  if (url.pathname === '/fragment/users') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<ul><li>Alice</li><li>Bob</li><li>Carol</li></ul>');
    return;
  }
  if (url.pathname === '/fragment/search') {
    const q = url.searchParams.get('q') ?? '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<p>Results for "${q}": Alice, Bob</p>`);
    return;
  }
  if (url.pathname === '/fragment/stats' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    });
    res.end('<p>Processed: 1234 · Success: 1200 · Exceptions: 34</p>');
    return;
  }

  // Static: the example page, Flux CSS, Flux full IIFE, htmx (for reference).
  let file;
  if (url.pathname === '/') file = join(here, 'index.html');
  else if (url.pathname === '/flux.css') file = join(repo, 'dist', 'flux.css');
  else if (url.pathname === '/flux.full.iife.js') file = join(repo, 'dist', 'flux.full.iife.js');
  else if (url.pathname === '/flux.iife.js') file = join(repo, 'dist', 'flux.iife.js');
  else if (url.pathname === '/htmx.js')
    file = join(repo, 'node_modules', 'htmx.org', 'dist', 'htmx.min.js');

  if (!file) {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  try {
    const body = await readFile(file);
    const mime = file.endsWith('.css')
      ? 'text/css'
      : file.endsWith('.js')
        ? 'text/javascript'
        : 'text/html';
    res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('build the project first: npm run build');
  }
});

server.listen(PORT, () => {
  process.stdout.write(`vanilla example on http://localhost:${PORT}\n`);
});
