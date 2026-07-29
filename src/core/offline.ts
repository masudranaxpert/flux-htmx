// Offline request queue. Intercepts htmx:beforeRequest when navigator is offline,
// serialises request details to localStorage, and replays on reconnection.

const STORAGE_KEY = 'flux:offline:queue';

export interface OfflineEntry {
  id: string;
  method: string;
  url: string;
  params: Record<string, string>;
  timestamp: number;
}

// --- Queue helpers (localStorage with in-memory fallback) ---

function loadQueue(): OfflineEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: OfflineEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch {
    // Quota exceeded or private-mode storage unavailable — silently drop.
  }
}

function enqueue(entry: Omit<OfflineEntry, 'id' | 'timestamp'>): void {
  const q = loadQueue();
  q.push({ ...entry, id: crypto.randomUUID(), timestamp: Date.now() });
  saveQueue(q);
}

function dequeueAll(): OfflineEntry[] {
  const q = loadQueue();
  saveQueue([]);
  return q;
}

// --- Replay ---

async function replayEntry(
  entry: OfflineEntry,
  activeHtmx: any,
): Promise<void> {
  const method = entry.method.toLowerCase();
  const url = entry.url;

  // Prefer htmx.ajax so normal htmx swap lifecycle fires.
  if (typeof activeHtmx?.ajax === 'function') {
    await activeHtmx.ajax(method, url, { values: entry.params });
  } else {
    // Raw fetch fallback — server still gets the data.
    const body = new URLSearchParams(entry.params).toString();
    await fetch(url, {
      method: entry.method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: method === 'get' ? undefined : body,
    });
  }
  document.dispatchEvent(
    new CustomEvent('flux:offline:replayed', { detail: entry }),
  );
}

export async function flush(activeHtmx: any): Promise<void> {
  const entries = dequeueAll();
  for (const entry of entries) {
    try {
      await replayEntry(entry, activeHtmx);
    } catch {
      // Re-queue on failure so we don't lose data.
      enqueue(entry);
    }
  }
}

// --- Public API ---

export function pendingCount(): number {
  return loadQueue().length;
}

export function clearOfflineQueue(): void {
  saveQueue([]);
}

// --- Lifecycle ---

export function installOfflineSupport(
  getHtmx: () => any,
): () => void {
  if (typeof document === 'undefined') return () => {};

  const onBeforeRequest = (evt: Event): void => {
    if (navigator.onLine) return;

    const detail = (evt as CustomEvent).detail ?? {};
    const elt = detail.elt as Element | undefined;
    if (!elt?.hasAttribute('fx-offline')) return;

    // Cancel the live request and queue it instead.
    evt.preventDefault();

    const method: string = detail.requestConfig?.verb ?? 'get';
    const url: string = detail.requestConfig?.path ?? detail.path ?? '';
    const rawParams = detail.requestConfig?.parameters ?? {};
    // Flatten to Record<string,string> for JSON serialisation.
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawParams)) {
      params[k] = String(v);
    }

    enqueue({ method, url, params });

    document.dispatchEvent(
      new CustomEvent('flux:offline:queued', {
        detail: { method, url, params },
      }),
    );
  };

  const onOnline = (): void => {
    flush(getHtmx());
  };

  document.addEventListener('htmx:beforeRequest', onBeforeRequest);
  window.addEventListener('online', onOnline);

  // Replay any leftover entries from a previous session on install.
  if (navigator.onLine) flush(getHtmx());

  return () => {
    document.removeEventListener('htmx:beforeRequest', onBeforeRequest);
    window.removeEventListener('online', onOnline);
  };
}
