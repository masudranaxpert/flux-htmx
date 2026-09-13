// Header normalisation helpers. HTMX 4 may hand request headers as a `Headers`
// instance or a plain record depending on the code path; spreading a `Headers`
// object yields `{}` and silently drops every header (CSRF included).

/**
 * Reads a header case-insensitively from a `Headers` instance or a plain record.
 */
export function readHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;
  if (typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function') {
    const getter = headers.get as (n: string) => string | null | undefined;
    return getter(name) ?? getter(name.toLowerCase()) ?? null;
  }
  if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (k.toLowerCase() === name.toLowerCase() && v !== undefined && v !== null) {
        return String(v);
      }
    }
  }
  return null;
}

/** Copies `Headers`-or-record into a plain record for reuse in retry/replay calls. */
export function headersToRecord(headers: unknown): Record<string, string> {
  if (!headers) return {};
  if (
    typeof headers === 'object' &&
    'entries' in headers &&
    typeof headers.entries === 'function'
  ) {
    const out: Record<string, string> = {};
    for (const [k, v] of (headers.entries as () => Iterable<[string, string]>)()) {
      out[k] = v;
    }
    return out;
  }
  if (typeof headers === 'object') {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (v !== undefined && v !== null) out[k] = String(v);
    }
    return out;
  }
  return {};
}

/** Merges extra headers onto an unknown headers shape, preserving all existing values. */
export function withHeaders(base: unknown, extra: Record<string, string>): Record<string, string> {
  return { ...headersToRecord(base), ...extra };
}

/** Sets a header on either a `Headers` instance or a plain-record request shape. */
export function setHeader(headers: unknown, name: string, value: string): void {
  if (!headers || typeof headers !== 'object') return;
  if ('set' in headers && typeof headers.set === 'function') {
    (headers.set as (n: string, v: string) => void)(name, value);
    return;
  }
  Object.assign(headers as Record<string, string>, { [name]: value });
}
