// Admin-panel widgets: fx-log, fx-copy, fx-ago, fx-shortcut, unsaved-changes guard,
// upload progress surfacing. Pure event delegation + one shared observer/interval.

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

function handleLogMutation(mutation: MutationRecord): void {
  const target = mutation.target as HTMLElement | null;
  const container = target?.closest?.('[fx-log]') as HTMLElement | null;
  if (!container) return;
  keepPinned(container, () => {
    const cap = parseInt(container.getAttribute('fx-log') ?? '', 10);
    capLines(container, Number.isFinite(cap) && cap > 0 ? cap : LOG_CAP_DEFAULT);
  });
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
  const label = trigger.textContent;
  trigger.setAttribute('data-flux-copied', 'true');
  trigger.textContent = 'Copied!';
  setTimeout(() => {
    trigger.textContent = label;
    trigger.removeAttribute('data-flux-copied');
  }, 1500);
}

// ---- fx-ago: relative time ----
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

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
    if (abs >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return iso;
}

function updateAgo(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[fx-ago]')) {
    const iso = el.getAttribute('datetime') ?? el.getAttribute('title') ?? el.textContent ?? '';
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

function onShortcutKeydown(e: KeyboardEvent): void {
  for (const el of document.querySelectorAll<HTMLElement>('[fx-shortcut]')) {
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
  // htmx-boosted navigation away with unsaved forms: confirm via the event gate
  if (!hasUnsavedForms()) return;
  const detail = (evt as CustomEvent).detail as {
    elt?: Element;
    requestConfig?: { elt?: Element };
  } | null;
  const source = detail?.elt ?? detail?.requestConfig?.elt;
  if (source && !source.closest('form[fx-dirty]') && !confirm('Leave without saving changes?')) {
    evt.preventDefault();
  }
}

// ---- upload progress: XHR progress -> form attribute + <progress> fill ----
function onUploadProgress(evt: Event): void {
  const detail = (evt as CustomEvent).detail as {
    lengthComputable?: boolean;
    loaded?: number;
    total?: number;
  } | null;
  const elt = (evt.target as Element | null)?.closest('form') ?? (evt.target as Element | null);
  const { lengthComputable, loaded, total } = detail ?? {};
  if (!elt || !lengthComputable || !total || loaded === undefined) return;
  const pct = Math.round((loaded / total) * 100);
  elt.setAttribute('data-flux-progress', String(pct));
  const bar = elt.querySelector('progress');
  if (bar) bar.value = pct;
  if (pct >= 100) setTimeout(() => elt.removeAttribute('data-flux-progress'), 2000);
}

/** Installs every widget. Returns a teardown. */
export function installWidgets(): () => void {
  if (typeof document === 'undefined') return () => {};

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) handleLogMutation(m);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let agoTimer: ReturnType<typeof setInterval> | undefined;
  const startAgo = () => {
    updateAgo();
    clearInterval(agoTimer);
    if (document.visibilityState === 'visible') agoTimer = setInterval(updateAgo, 60_000);
  };

  const onVisibility = () => startAgo();

  document.addEventListener('click', onCopyClick);
  document.addEventListener('keydown', onShortcutKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('htmx:before:request', onGuardedRequest, true);
  document.addEventListener('htmx:xhr:progress', onUploadProgress);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('htmx:after:settle', updateAgo);
  startAgo();

  return () => {
    observer.disconnect();
    clearInterval(agoTimer);
    document.removeEventListener('click', onCopyClick);
    document.removeEventListener('keydown', onShortcutKeydown);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('htmx:before:request', onGuardedRequest, true);
    document.removeEventListener('htmx:xhr:progress', onUploadProgress);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('htmx:after:settle', updateAgo);
  };
}
