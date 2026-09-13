// Datagrid controllers: fx-sort, fx-sync-url, fx-include-selection.
// Pure event delegation — no per-element registry, nothing to leak.

declare global {
  interface Window {
    htmx?: { ajax?: Function; trigger?: Function; process?: Function };
  }
}

function queryOrNull(selector: string | null | undefined): Element | null {
  if (!selector || !selector.trim()) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function htmxApi(): Window['htmx'] {
  return (window as Window).htmx ?? (globalThis as { htmx?: Window['htmx'] }).htmx;
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
  const dir =
    table.getAttribute('data-sort-field') === key && table.getAttribute('data-sort-dir') === 'asc'
      ? 'desc'
      : table.getAttribute('data-sort-field') === key &&
          table.getAttribute('data-sort-dir') === 'desc'
        ? 'none'
        : 'asc';

  if (dir === 'none') {
    table.removeAttribute('data-sort-field');
    table.removeAttribute('data-sort-dir');
  } else {
    table.setAttribute('data-sort-field', key);
    table.setAttribute('data-sort-dir', dir);
  }
  for (const header of table.querySelectorAll('th[aria-sort]')) header.removeAttribute('aria-sort');
  if (dir !== 'none') th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');

  const sep = url.includes('?') ? '&' : '?';
  const sortQuery = dir === 'none' ? '' : `${sep}sort=${encodeURIComponent(key)}&dir=${dir}`;
  const api = htmxApi();
  if (api?.ajax) {
    // strip previous sort params from the url; the table element carries its own
    // hx-target/hx-swap, so passing it as the htmx context honours them
    const clean = url.replace(/([?&])sort=[^&]*&dir=[^&]*/g, '$1').replace(/\?$/, '');
    void api.ajax('GET', `${clean}${sortQuery}`, table);
  }
}

/** Keep checked `input[fx-select]` values flowing into bulk-action requests. */
function onBulkConfigRequest(evt: Event): void {
  const detail = (evt as CustomEvent).detail as
    | { ctx?: { source?: Element; request?: { parameters?: Record<string, unknown> } } }
    | undefined;
  const source = detail?.ctx?.source;
  const btn = source?.closest?.('[fx-include-selection]') as HTMLElement | null;
  const container = queryOrNull(btn?.getAttribute('fx-include-selection'));
  if (!btn || !container || !detail?.ctx?.request) return;
  const params = detail.ctx.request.parameters ?? (detail.ctx.request.parameters = {});
  const checked = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"][fx-select]:checked'),
  );
  const name = checked[0]?.name ?? 'id';
  delete params[name];
  params[name] = checked.map((c) => c.value);
}

function onContainerChange(): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[fx-include-selection]')) {
    const container = queryOrNull(btn.getAttribute('fx-include-selection'));
    if (!container) continue;
    const any = container.querySelector('input[type="checkbox"][fx-select]:checked') !== null;
    if (btn.tagName === 'BUTTON' || btn.tagName === 'INPUT') {
      (btn as HTMLButtonElement).disabled = !any;
    }
  }
}

/** Mirror filter/search/table state into the address bar (shareable, refresh-safe). */
function onSyncUrlAfterRequest(evt: Event): void {
  const detail = (evt as CustomEvent).detail as { ctx?: { source?: Element } } | undefined;
  const el = detail?.ctx?.source?.closest?.('[fx-sync-url]') as HTMLFormElement | null;
  if (!el) return;
  const params = new URLSearchParams(new FormData(el as HTMLFormElement).toString());
  if ([...params.entries()].length === 0) {
    history.replaceState(null, '', location.pathname);
  } else {
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }
}

/** Prefill fx-sync-url inputs from the address bar and re-request on back/forward. */
function prefillSyncUrl(): void {
  for (const el of document.querySelectorAll<HTMLFormElement>('[fx-sync-url]')) {
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
  document.addEventListener('popstate', onPopState);
  prefillSyncUrl();
  return () => {
    document.removeEventListener('click', onSortClick);
    document.removeEventListener('htmx:config:request', onBulkConfigRequest);
    document.removeEventListener('change', onContainerChange);
    document.removeEventListener('htmx:after:request', onSyncUrlAfterRequest);
    document.removeEventListener('popstate', onPopState);
  };
}
