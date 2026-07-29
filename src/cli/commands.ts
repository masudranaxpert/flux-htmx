// CLI command handlers. Pure functions of their arguments + the filesystem, so they are
// unit-testable without spawning a process.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface CliOptions {
  dryRun: boolean;
}

/** Parses argv into a command + positional + flags. */
export function parseArgs(argv: string[]): {
  command: string;
  positional: string[];
  options: CliOptions;
} {
  const options: CliOptions = { dryRun: false };
  const positional: string[] = [];
  let command = '';
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (!command) command = arg;
    else positional.push(arg);
  }
  return { command, positional, options };
}

export async function cliMain(argv: string[]): Promise<void> {
  const { command, positional, options } = parseArgs(argv);
  switch (command) {
    case 'init':
      runInit(options);
      return;
    case 'add':
      if (!positional[0]) throw new Error('usage: flux-ui add <component>');
      runAdd(positional[0], options);
      return;
    case 'doctor':
      runDoctor(positional[0] ?? '.', options);
      return;
    case 'inspect':
      if (!positional[0]) throw new Error('usage: flux-ui inspect <file>');
      runInspect(positional[0]);
      return;
    case '':
    case 'help':
    case '--help':
      process.stdout.write(USAGE);
      return;
    default:
      throw new Error(`unknown command "${command}". ${USAGE}`);
  }
}

const USAGE = `flux-ui — Flux developer tool

Usage:
  flux-ui init [--dry-run]
  flux-ui add <component> [--dry-run]
  flux-ui doctor [path]
  flux-ui inspect <file.html>
`;

// --- init ---------------------------------------------------------------------

const INIT_SNIPPET = `<!-- Flux: configure before htmx starts -->
<meta name="flux-config" content='{"autoStart":true}' />
<link rel="stylesheet" href="/flux/flux.css" />
<script defer src="/flux/flux.full.iife.js"></script>
`;

export function runInit(options: CliOptions): void {
  const target = resolve('flux-snippet.html');
  if (existsSync(target)) {
    process.stdout.write(`flux-ui init: ${target} already exists, not overwriting\n`);
    return;
  }
  if (options.dryRun) {
    process.stdout.write(`[dry-run] would create ${target}\n`);
    return;
  }
  writeFileSync(target, INIT_SNIPPET, 'utf8');
  process.stdout.write(`created ${target} — copy these tags into your <head>\n`);
}

// --- add ----------------------------------------------------------------------

const COMPONENT_SNIPPETS: Record<string, string> = {
  dialog: `<!-- fx-dialog + fx-open -->
<button class="flux-btn" fx-open="#dlg">Open dialog</button>
<dialog id="dlg" class="flux-card">
  <p>Dialog content</p>
  <form method="dialog"><button class="flux-btn" fx-close>Close</button></form>
</dialog>`,
  toast: `<!-- toast region (populate via Flux toast event) -->
<div class="flux-toast-region" role="region" aria-label="Notifications"></div>`,
  progress: `<progress class="flux-progress" value="65" max="100">65%</progress>`,
};

export function runAdd(component: string, options: CliOptions): void {
  const snippet = COMPONENT_SNIPPETS[component];
  if (!snippet) {
    throw new Error(
      `unknown component "${component}". Available: ${Object.keys(COMPONENT_SNIPPETS).join(', ')}`,
    );
  }
  const dir = resolve('flux-components');
  const target = join(dir, `${component}.html`);
  if (options.dryRun) {
    process.stdout.write(`[dry-run] would write ${target}\n`);
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, snippet, 'utf8');
  process.stdout.write(`added ${target}\n`);
}

// --- doctor -------------------------------------------------------------------

export interface Finding {
  level: 'warn' | 'error';
  message: string;
  file: string;
}

export function runDoctor(rootPath: string, _options: CliOptions): Finding[] {
  const root = resolve(rootPath);
  const findings: Finding[] = [];
  if (!existsSync(root)) {
    process.stdout.write(`flux-ui doctor: ${root} does not exist\n`);
    return findings;
  }

  const htmlFiles = listHtml(root);
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8');
    if (
      content.includes('fx-') &&
      !content.includes('flux.full') &&
      !content.includes('flux.iife')
    ) {
      findings.push({
        level: 'warn',
        message: 'fx-* attributes present but no Flux script tag found',
        file,
      });
    }

    if (
      (content.includes('fx-post') ||
        content.includes('fx-submit') ||
        content.includes('fx-delete')) &&
      !content.includes('csrf') &&
      !content.includes('CSRF')
    ) {
      findings.push({
        level: 'warn',
        message: 'mutation requests (post/submit/delete) found but no CSRF meta tag detected',
        file,
      });
    }

    if (/fx-method="(?!(get|post|put|patch|delete))/i.test(content)) {
      findings.push({
        level: 'error',
        message: 'invalid fx-method attribute found (allowed: get, post, put, patch, delete)',
        file,
      });
    }
  }

  for (const f of findings) {
    process.stdout.write(`[${f.level}] ${f.file}: ${f.message}\n`);
  }
  if (findings.length === 0) process.stdout.write('flux-ui doctor: no issues found\n');
  return findings;
}

function listHtml(root: string): string[] {
  try {
    const out: string[] = [];
    for (const entry of readdirSync(root)) {
      const full = join(root, entry);
      if (statSync(full).isFile() && /\.(html|htm|django|jinja)$/.test(entry)) out.push(full);
    }
    return out;
  } catch {
    return [];
  }
}

// --- inspect ------------------------------------------------------------------

/** Returns the HTMX expansion of fx-* attributes in the given HTML string. */
export function inspectHtml(html: string): string[] {
  const lines: string[] = [];
  const attrMap: Record<string, string> = {
    'fx-get': 'hx-get',
    'fx-post': 'hx-post',
    'fx-put': 'hx-put',
    'fx-patch': 'hx-patch',
    'fx-delete': 'hx-delete',
    'fx-target': 'hx-target',
    'fx-trigger': 'hx-trigger',
    'fx-swap': 'hx-swap',
    'fx-sync': 'hx-sync',
    'fx-indicator': 'hx-indicator',
    'fx-confirm': 'hx-confirm',
  };

  for (const [fx, hx] of Object.entries(attrMap)) {
    const re = new RegExp(`${fx}="([^"]*)"`, 'g');
    for (const match of html.matchAll(re)) {
      lines.push(`${fx}="${match[1]}" → ${hx}="${match[1]}"`);
    }
  }

  // fx-search expansion
  for (const match of html.matchAll(/fx-search="([^"]*)"(?:[^>]*fx-delay="([^"]*)")?/g)) {
    const url = match[1];
    const delay = match[2] ?? '300ms';
    lines.push(`fx-search="${url}"`);
    lines.push(`  → hx-get="${url}"`);
    lines.push(`  → hx-trigger="input changed delay:${delay}"`);
    lines.push(`  → hx-sync="this:replace"`);
  }

  // fx-submit expansion
  for (const match of html.matchAll(/fx-submit="([^"]*)"/g)) {
    const url = match[1];
    lines.push(`fx-submit="${url}"`);
    lines.push(`  → hx-post="${url}"`);
    lines.push(`  → submit reset & duplicate prevention enabled`);
  }

  // fx-autosave expansion
  for (const match of html.matchAll(/fx-autosave="([^"]*)"/g)) {
    const url = match[1];
    lines.push(`fx-autosave="${url}"`);
    lines.push(`  → hx-post="${url}"`);
    lines.push(`  → hx-trigger="input changed delay:500ms, change changed"`);
    lines.push(`  → hx-sync="this:replace"`);
  }

  // fx-morph expansion
  if (html.includes('fx-morph')) {
    lines.push(`fx-morph → hx-swap="innerMorph"`);
  }

  // fx-on status expansion
  for (const match of html.matchAll(/fx-on-(\d+)="([^"]*)"/g)) {
    const status = match[1];
    const target = match[2];
    lines.push(`fx-on-${status}="${target}" → hx-target-${status}="${target}"`);
  }

  return lines;
}

export function runInspect(file: string): void {
  const content = readFileSync(resolve(file), 'utf8');
  const lines = inspectHtml(content);
  if (lines.length === 0) {
    process.stdout.write('no Flux attributes found\n');
    return;
  }
  process.stdout.write(lines.join('\n') + '\n');
}
