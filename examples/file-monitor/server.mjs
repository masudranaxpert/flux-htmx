#!/usr/bin/env node
// File Monitor demo server. Serves the Flux and raw-HTMX comparison dashboards and HTML
// fragments for stats, exceptions table, and delete actions.
// Run: node examples/file-monitor/server.mjs → http://localhost:4321
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const PORT = 4321;

const exceptions = [
  { id: 1, file: 'invoice_2024.pdf', error: 'OCR failed', time: '10:42' },
  { id: 2, file: 'contract.docx', error: 'Virus detected', time: '10:38' },
  { id: 3, file: 'scan.tiff', error: 'Corrupted', time: '10:15' },
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === '/fragment/stats' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    });
    res.end(`
      <div class="flux-grid" data-cols="3">
        <div class="flux-card"><strong>1234</strong><br /><span class="flux-muted">Processed</span></div>
        <div class="flux-card"><strong>1200</strong><br /><span class="flux-muted">Successful</span></div>
        <div class="flux-card"><strong>34</strong><br /><span class="flux-muted">Exceptions</span></div>
      </div>
      <progress class="flux-progress" value="97" max="100">97%</progress>
    `);
    return;
  }

  if (path === '/fragment/exceptions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderExceptionsTable());
    return;
  }

  if (path === '/fragment/exceptions/delete' && req.method === 'DELETE') {
    const id = Number(url.searchParams.get('id'));
    const idx = exceptions.findIndex((e) => e.id === id);
    if (idx >= 0) exceptions.splice(idx, 1);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderExceptionsTable());
    return;
  }

  // Static serving.
  let file;
  if (path === '/') file = join(here, 'flux', 'index.html');
  else if (path === '/raw') file = join(here, 'raw', 'index.html');
  else if (path === '/flux.css') file = join(repo, 'dist', 'flux.css');
  else if (path === '/flux.full.iife.js') file = join(repo, 'dist', 'flux.full.iife.js');
  else if (path === '/htmx.js')
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

function renderExceptionsTable() {
  if (exceptions.length === 0) {
    return '<p class="flux-muted">No exceptions. All caught up.</p>';
  }
  const rows = exceptions
    .map(
      (e) => `
      <tr>
        <td data-label="File">${e.file}</td>
        <td data-label="Error">${e.error}</td>
        <td data-label="Time">${e.time}</td>
        <td data-label="Action">
          <button class="flux-btn"
                  fx-delete="/fragment/exceptions/delete?id=${e.id}"
                  fx-target="closest tr"
                  fx-swap="delete"
                  fx-confirm="Delete this exception?"
                  fx-success="Exception removed">
            Delete
          </button>
        </td>
      </tr>`,
    )
    .join('');
  return `
    <table class="flux-table" data-responsive="cards">
      <thead><tr><th>File</th><th>Error</th><th>Time</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

server.listen(PORT, () => {
  process.stdout.write(`File Monitor demo on http://localhost:${PORT} (Flux) and /raw\n`);
});
