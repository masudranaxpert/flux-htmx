// Datagrid controllers: fx-sort, fx-sync-url, fx-include-selection.
// Pure event delegation — no per-element registry, nothing to leak.

import { queryOne } from './selectors.js';
import { log } from './logger.js';

type AjaxFn = (verb: string, path: string, ctx?: unknown) => unknown;
interface HtmxApi {
  ajax?: AjaxFn;
  trigger?: (el: Element, name: string) => void;
  process?: (el: Element) => void;
}

function htmxApi(): HtmxApi | undefined {
  return (window as { htmx?: HtmxApi }).htmx ?? (globalThis as { htmx?: HtmxApi }).htmx;
}

/** Table column sorting: click `th[fx-sort]` to cycle asc -> desc -> none. */
function onSortClick(evt: Event): void {
  const th = (evt.target as HTMLElement | null)?.closest('th[fx-sort],th[data-sort]');
  if (!th) return;
  const table = th.closest('table');
  const url = table?.getAttribute('fx-sort-url') ?? table?.getAttribute('hx-get');
  if (!table || !url) return;

  const key =
    th.getAttribute('fx-sort') ||
    th.getAttribute('data-sort') ||
    (th.textContent ?? '').trim().toLowerCase();
  const prevField = table.getAttribute('data-sort-field');
  const prevDir = table.getAttribute('data-sort-dir');
  const dir = prevField === key && prevDir === 'asc' ? 'desc' : prevField === key && prevDir === 'desc' ? 'none' : 'asc';

  for (const header of table.querySelectorAll('th[aria-sort]')) header.removeAttribute('aria-sort');
  if (dir === 'none') {
    table.removeAttribute('data-sort-field');
    table.removeAttribute('data-sort-dir');
  } else {
    table.setAttribute('data-sort-field', key);
    table.setAttribute('data-sort-dir', dir);
    th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
  }

  const api = htmxApi();
  if (api?.ajax) {
    try {
      const u = new URL(url, location.href);
      if (dir === 'none') {
        u.searchParams.delete('sort');
        u.searchParams.delete('dir');
      } else {
        u.searchParams.set('sort', key);
        u.searchParams.set('dir', dir);
      }
      // { source } keeps the element's own hx-target/hx-swap in charge
      void api.ajax('GET', `${u.pathname}${u.search}`, { source: table });
    } catch (e) {
      log.warn('[flux] fx-sort: invalid url', url, e);
    }
  }
}

/** Keep checked `input[fx-select]` values flowing into bulk-action requests. */
function onBulkConfigRequest(evt: Event): void {
  const detail = (evt as CustomEvent).detail as
    | { ctx?: { source?: Element; request?: { parameters?: Record<string, unknown> } } }
    | undefined;
  const source = detail?.ctx?.source;
  const btn = source?.closest?.('[fx-include-selection]') as HTMLElement | null;
  if (!btn || !detail?.ctx?.request) return;
  const container = queryOne(btn.getAttribute('fx-include-selection') ?? '');
  if (!container) return;
  const checked = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"][fx-select]:checked'),
  );
  if (checked.length === 0) return;
  const name = checked[0]?.name || 'id';
  const params = detail.ctx.request.parameters ?? (detail.ctx.request.parameters = {});
  delete params[name];
  params[name] = checked.map((c) => c.value);
}

function syncBulkButton(btn: HTMLButtonElement): void {
  const container = queryOne(btn.getAttribute('fx-include-selection') ?? '');
  const any =
    container !== null &&
    container.querySelector('input[type="checkbox"][fx-select]:checked') !== null;
  if (any) {
    if (btn.dataset.fluxBulkGate === '1') btn.disabled = false; // only re-enable ours
  } else {
    btn.disabled = true;
    btn.dataset.fluxBulkGate = '1';
  }
}

function onContainerChange(evt: Event): void {
  const target = evt.target as HTMLElement | null;
  if (!target || !target.matches('input[type="checkbox"][fx-select]')) return;
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[fx-include-selection]')) {
    const scope = queryOne(btn.getAttribute('fx-include-selection') ?? '');
    if (scope && scope.contains(target)) syncBulkButton(btn);
  }
}

/** Mirror filter/search/table state into the address bar (shareable, refresh-safe). */
function onSyncUrlAfterRequest(evt: Event): void {
  const detail = (evt as CustomEvent).detail as { ctx?: { source?: Element } } | undefined;
  const el = detail?.ctx?.source?.closest?.('[fx-sync-url]');
  if (!(el instanceof HTMLFormElement)) return; // non-form variants unsupported
  const params = new URLSearchParams(Array.from(new FormData(el).entries()) as string[][]);
  if ([...params.entries()].length === 0) {
    history.replaceState(null, '', location.pathname);
  } else {
    // pushState: each filter change creates a history entry so Back walks states
    history.pushState(null, '', `${location.pathname}?${params.toString()}`);
  }
}

/** Prefill fx-sync-url forms from the address bar. */
function prefillSyncUrl(): void {
  for (const el of document.querySelectorAll('[fx-sync-url]')) {
    if (!(el instanceof HTMLFormElement)) continue;
    for (const [key, value] of new URLSearchParams(location.search)) {
      const input = el.elements.namedItem(key) as HTMLInputElement | null;
      if (input) input.value = value;
    }
  }
}

function onPopState(): void {
  prefillSyncUrl();
  for (const el of document.querySelectorAll('[fx-sync-url]')) {
    htmxApi()?.trigger?.(el, 'submit');
  }
}

/** Installs all datagrid controllers. Returns a teardown. */
export function installDatagrid(): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('click', onSortClick);
  document.addEventListener('htmx:config:request', onBulkConfigRequest);
  document.addEventListener('change', onContainerChange);
  document.addEventListener('htmx:after:request', onSyncUrlAfterRequest);
  window.addEventListener('popstate', onPopState);
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[fx-include-selection]')) {
    syncBulkButton(btn); // correct initial disabled state on load
  }
  prefillSyncUrl();
  return () => {
    document.removeEventListener('click', onSortClick);
    document.removeEventListener('htmx:config:request', onBulkConfigRequest);
    document.removeEventListener('change', onContainerChange);
    document.removeEventListener('htmx:after:request', onSyncUrlAfterRequest);
    window.removeEventListener('popstate', onPopState);
  };
}
