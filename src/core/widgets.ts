// Admin-panel widgets: fx-log, fx-copy, fx-ago, fx-shortcut, unsaved-changes guard,
// upload progress surfacing. Pure event delegation + one shared observer/interval.

import { getRequestContext } from './events.js';

const LOG_CAP_DEFAULT = 1000;

function targetOf(el: Element, selector: string | null): HTMLElement | null {
  if (!selector || selector === 'this') return el as HTMLElement;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

// ---- fx-log: auto-scroll log viewer with a line cap ----
function keepPinned(container: HTMLElement, mutate: () => void): void {
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 8;
  mutate();
  if (nearBottom) container.scrollTop = container.scrollHeight;
}

function capLines(container: HTMLElement, cap: number): void {
  const children = container.children;
  let excess = children.length - cap;
  while (excess-- > 0 && children.length > 0) children[0]!.remove();
}

const logObservers: MutationObserver[] = [];

function observeLog(container: HTMLElement, seen: WeakSet<Node>): void {
  if (seen.has(container)) return;
  seen.add(container);
  const observer = new MutationObserver(() => {
    const cap = parseInt(container.getAttribute('fx-log') ?? '', 10); // re-read live
    const maxLines = Number.isFinite(cap) && cap > 0 ? cap : LOG_CAP_DEFAULT;
    keepPinned(container, () => capLines(container, maxLines));
  });
  observer.observe(container, { childList: true });
  logObservers.push(observer);
}

// ---- fx-copy ----
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function onCopyClick(evt: Event): Promise<void> {
  const trigger = (evt.target as HTMLElement | null)?.closest('[fx-copy]');
  if (!trigger) return;
  const source = targetOf(trigger, trigger.getAttribute('fx-copy'));
  const text = (source as HTMLInputElement | null)?.value ?? source?.textContent ?? '';
  if (!(await copyText(text.trim()))) return;
  // attribute-only feedback (CSS ::after renders it) — never clobber inner markup
  trigger.setAttribute('data-flux-copied', 'true');
  setTimeout(() => trigger.removeAttribute('data-flux-copied'), 1500);
}

// ---- fx-ago: relative time ----
let rtf: Intl.RelativeTimeFormat | undefined;
function formatter(): Intl.RelativeTimeFormat {
  return (rtf ??= new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }));
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') return formatter().format(Math.round(diff / ms), unit);
  }
  return iso;
}

function updateAgo(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[fx-ago]')) {
    const iso =
      el.dataset.fluxAgoSrc ??
      el.getAttribute('datetime') ??
      el.getAttribute('title') ??
      el.textContent?.trim() ??
      '';
    if (!el.dataset.fluxAgoSrc && iso) el.dataset.fluxAgoSrc = iso;
    if (!iso) continue; // nothing parseable — never wipe the element's content
    const text = relativeTime(iso);
    if (el.textContent !== text) el.textContent = text;
  }
}

// ---- fx-shortcut: eval-free keyboard bindings ----
function shortcutMatches(e: KeyboardEvent, binding: string): boolean {
  const parts = binding
    .toLowerCase()
    .split('+')
    .map((p) => p.trim());
  const key = parts[parts.length - 1];
  const need = {
    ctrl: parts.includes('ctrl') || parts.includes('cmd') || parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
  if (need.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (need.shift !== e.shiftKey) return false;
  if (need.alt !== e.altKey) return false;
  return e.key.toLowerCase() === key;
}

let shortcutCache: HTMLElement[] = [];
function refreshShortcuts(): void {
  shortcutCache = Array.from(document.querySelectorAll<HTMLElement>('[fx-shortcut]'));
}

function onShortcutKeydown(e: KeyboardEvent): void {
  shortcutCache = shortcutCache.filter((el) => el.isConnected);
  const t = e.target as HTMLElement | null;
  const typing =
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t !== null && t.isContentEditable);
  if (t && typing && !(e.ctrlKey || e.metaKey || e.altKey)) {
    return; // bare-letter bindings must never hijack typing
  }
  if (shortcutCache.length === 0) refreshShortcuts();
  for (const el of shortcutCache) {
    if (shortcutMatches(e, el.getAttribute('fx-shortcut') ?? '')) {
      e.preventDefault();
      el.click();
      return;
    }
  }
}

// ---- unsaved-changes guard ----
function hasUnsavedForms(): boolean {
  return document.querySelector('form[fx-dirty][data-dirty="true"]') !== null;
}

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasUnsavedForms()) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function onGuardedRequest(evt: Event): void {
  // htmx-boosted navigation away with unsaved forms (htmx 4 shape via context)
  if (!hasUnsavedForms()) return;
  const source = getRequestContext(evt).source;
  if (source && !source.closest('form[fx-dirty]') && !confirm('Leave without saving changes?')) {
    evt.preventDefault();
  }
}

/** Installs every widget. Returns a teardown. */
export function installWidgets(): () => void {
  if (typeof document === 'undefined') return () => {};

  const seenLogs = new WeakSet<Node>();
  const attachLogs = () => {
    for (const log of document.querySelectorAll<HTMLElement>('[fx-log]')) observeLog(log, seenLogs);
  };
  attachLogs();

  let agoTimer: ReturnType<typeof setInterval> | undefined;
  const startAgo = () => {
    updateAgo();
    clearInterval(agoTimer);
    // presence-gated: no [fx-ago] on the page -> no interval at all
    if (document.querySelector('[fx-ago]') && document.visibilityState === 'visible') {
      agoTimer = setInterval(updateAgo, 60_000);
    }
  };

  const onVisibility = () => startAgo();

  document.addEventListener('click', onCopyClick);
  refreshShortcuts();
  document.addEventListener('htmx:after:settle', refreshShortcuts);
  document.addEventListener('keydown', onShortcutKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('htmx:before:request', onGuardedRequest, true);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('htmx:after:settle', updateAgo);
  document.addEventListener('htmx:after:settle', attachLogs);
  startAgo();

  return () => {
    for (const o of logObservers) o.disconnect();
    logObservers.length = 0;
    shortcutCache = [];
    clearInterval(agoTimer);
    document.removeEventListener('htmx:after:settle', attachLogs);
    document.removeEventListener('click', onCopyClick);
    document.removeEventListener('keydown', onShortcutKeydown);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('htmx:before:request', onGuardedRequest, true);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('htmx:after:settle', updateAgo);
    document.removeEventListener('htmx:after:settle', refreshShortcuts);
  };
}
