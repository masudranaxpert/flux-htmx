// HTMX cache integration adapter. Bridges HTMX event detail shape with FragmentCache.
// GET-only, handles fx-cache, fx-cache-mode, fx-cache-key, fx-invalidate, and response Vary header support.

import { FragmentCache, isCacheableMethod } from './cache.js';
import { getRequestContext } from '../core/events.js';

const CACHE_ATTR = 'fx-cache';
const CACHE_MODE_ATTR = 'fx-cache-mode';
const CACHE_KEY_ATTR = 'fx-cache-key';
const INVALIDATE_ATTR = 'fx-invalidate';

export interface CachePolicy {
  enabled: boolean;
  ttl?: number;
  swr: boolean;
}

export function parseCacheTtl(value: string | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = value.trim();
  if (normalized === 'true' || normalized === '') return 60_000;
  if (/^\d+$/.test(normalized)) return Number(normalized) * 1000;

  const match = /^(\d+)(ms|s|m|h|d)?$/i.exec(normalized);
  if (!match) return undefined;

  const num = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  switch (unit) {
    case 'ms':
      return num;
    case 's':
      return num * 1000;
    case 'm':
      return num * 60_000;
    case 'h':
      return num * 3600_000;
    case 'd':
      return num * 86400_000;
    default:
      return undefined;
  }
}

export function getCachePolicy(element: Element): CachePolicy {
  const cacheValue = element.getAttribute(CACHE_ATTR);
  const ttl = parseCacheTtl(cacheValue);
  const mode = element.getAttribute(CACHE_MODE_ATTR);
  const swr = mode === 'stale-while-revalidate';
  return { enabled: ttl !== undefined, ttl, swr };
}

function getHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(name) ?? (headers as any).get(name.toLowerCase()) ?? null;
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

export function canStoreResponse(
  request: { method?: string; headers?: unknown },
  response: { status?: number; ok?: boolean; headers?: unknown },
): boolean {
  const status = response.status ?? (response.ok ? 200 : 0);
  const cacheControl = (getHeader(response.headers, 'Cache-Control') ?? '').toLowerCase();
  const pragma = (getHeader(response.headers, 'Pragma') ?? '').toLowerCase();
  const contentType = (getHeader(response.headers, 'Content-Type') ?? '').toLowerCase();

  return (
    isCacheableMethod(request.method ?? 'GET') &&
    status >= 200 &&
    status < 300 &&
    status !== 204 &&
    !getHeader(request.headers, 'Authorization') &&
    !getHeader(response.headers, 'Authorization') &&
    !getHeader(response.headers, 'Set-Cookie') &&
    !(getHeader(response.headers, 'Vary') ?? '').trim() &&
    !['no-store', 'private', 'no-cache', 'max-age=0', 's-maxage=0'].some((token) =>
      cacheControl.includes(token),
    ) &&
    !pragma.includes('no-cache') &&
    (!contentType ||
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml'))
  );
}

export function installCacheIntegration(
  cache: FragmentCache,
  htmxInstance?: HtmxInstance,
): () => void {
  if (typeof document === 'undefined') return () => {};

  // config:request: intercept cacheable GET requests and serve from cache if fresh/stale
  const onConfigRequest = (evt: Event) => {
    const ctx = getRequestContext(evt);
    const source = ctx.source;
    const request = ctx.request;
    if (!source || !request) return;

    const policy = getCachePolicy(source);
    if (!policy.enabled) return;
    if (!isCacheableMethod(request.method ?? 'GET')) return;

    const key = cacheKey(source, request);
    const cached = cache.get(key, { allowStale: policy.swr, returnMeta: true });

    if (cached === null) {
      source.dispatchEvent(new CustomEvent('flux:cache:miss', { bubbles: true, detail: { key } }));
      return;
    }

    if (ctx.ctx) {
      if (!cached.isStale || !policy.swr) {
        ctx.ctx.isCacheHit = true;
      }
    }

    source.dispatchEvent(
      new CustomEvent('flux:cache:hit', {
        bubbles: true,
        detail: { key, text: cached.value, isStale: cached.isStale },
      }),
    );

    // Serve from cache: use injected htmx instance or fallback to window.htmx
    const htmx = htmxInstance ?? (window as unknown as { htmx?: HtmxInstance }).htmx;
    const target = ctx.target;
    if (htmx?.swap && target) {
      const swap = source.getAttribute('hx-swap') ?? source.getAttribute('fx-swap') ?? 'innerHTML';
      htmx.swap({ target, text: cached.value, swap });

      // In fresh cache hit or non-SWR mode, abort network fetch. Allow background revalidation fetch ONLY when entry is stale in SWR mode.
      if (!cached.isStale || !policy.swr) {
        request.abort?.();
      }
    }
  };

  // after:request: store successful GET responses and update cache store on fresh background response.
  const onAfterRequest = (evt: Event) => {
    const ctx = getRequestContext(evt);
    const source = ctx.source;
    const request = ctx.request;
    if (!source || !request) return;

    const text = ctx.text;
    const policy = getCachePolicy(source);
    const successful = ctx.successful;
    const status = ctx.status;
    const is204 = status === 204;

    const getHeader = (name: string): string | null => {
      const lower = name.toLowerCase();
      const hCtx =
        ctx.ctx.xhr?.getResponseHeader?.(name) ?? ctx.detail.xhr?.getResponseHeader?.(name);
      if (hCtx) return hCtx;

      const resHeaders = ctx.ctx.response?.headers;
      if (!resHeaders) return null;

      if (typeof (resHeaders as any).get === 'function') {
        const val = (resHeaders as any).get(name) ?? (resHeaders as any).get(lower);
        if (val) return val;
      }
      if (typeof resHeaders === 'object') {
        for (const [k, v] of Object.entries(resHeaders as Record<string, string>)) {
          if (k.toLowerCase() === lower) return String(v);
        }
      }
      return null;
    };

    const response = {
      status,
      headers: {
        get: (name: string) => getHeader(name),
      },
    };

    if (
      policy.enabled &&
      policy.ttl !== undefined &&
      text !== null &&
      text !== undefined &&
      successful &&
      !is204 &&
      canStoreResponse(request, response)
    ) {
      const key = cacheKey(source, request);
      cache.set(key, text, policy.ttl);
    }

    // Process fx-invalidate attribute on successful mutation responses
    if (successful && request.method && request.method.toUpperCase() !== 'GET') {
      const pattern = source.getAttribute(INVALIDATE_ATTR);
      if (pattern) {
        const normalized = normalizeInvalidationPattern(pattern);
        if (pattern.includes('*')) {
          cache.invalidateMatching(normalized);
        } else {
          cache.invalidate(normalized);
        }
      }
    }
  };

  document.addEventListener('htmx:config:request', onConfigRequest);
  document.addEventListener('htmx:after:request', onAfterRequest);

  return () => {
    document.removeEventListener('htmx:config:request', onConfigRequest);
    document.removeEventListener('htmx:after:request', onAfterRequest);
  };
}

export function cacheKey(
  source: Element,
  request: { method?: string; action?: string; parameters?: Record<string, unknown> },
): string {
  const explicitKey = source.getAttribute(CACHE_KEY_ATTR);
  if (explicitKey) return explicitKey.startsWith('GET:') ? explicitKey : `GET:${explicitKey}`;

  const method = (request.method ?? 'GET').toUpperCase();
  const rawAction = (request.action ?? '').split('#')[0] ?? '';

  let canonicalPath: string = rawAction;
  if (typeof document !== 'undefined' && document.baseURI) {
    try {
      const parsedUrl = new URL(rawAction, document.baseURI);
      const splitHref = (parsedUrl.href.split('?')[0] ?? '').split('#')[0] ?? '';
      canonicalPath = parsedUrl.origin === window.location.origin ? parsedUrl.pathname : splitHref;
    } catch {
      canonicalPath = rawAction;
    }
  }

  const cacheVaryAttr = source.getAttribute('fx-cache-vary');
  const allowedVaryFields = cacheVaryAttr
    ? new Set(cacheVaryAttr.split(',').map((s) => s.trim().toLowerCase()))
    : null;

  const isFormSource = source instanceof HTMLFormElement;
  const formElement = isFormSource ? (source as HTMLFormElement) : null;

  const params = new URLSearchParams();
  let basePath = canonicalPath;

  if (rawAction.includes('?')) {
    const qIndex = rawAction.indexOf('?');
    const existingParams = new URLSearchParams(rawAction.slice(qIndex + 1));
    for (const [k, v] of Array.from(existingParams.entries())) {
      if (isSensitiveFieldName(k, formElement)) continue;
      if (allowedVaryFields && !allowedVaryFields.has(k.toLowerCase())) continue;
      params.append(k, v);
    }
  }

  if (request.parameters) {
    for (const [k, v] of Object.entries(request.parameters)) {
      if (v !== undefined && v !== null) {
        if (isSensitiveFieldName(k, formElement)) continue;
        if (allowedVaryFields && !allowedVaryFields.has(k.toLowerCase())) continue;

        params.delete(k);
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) {
            params.append(`${k}[${i}]`, String(v[i]));
          }
        } else {
          params.append(k, String(v));
        }
      }
    }
  } else if (isFormSource && formElement) {
    try {
      const formData = new FormData(formElement);
      const seenKeys = new Set<string>();
      for (const [k, v] of Array.from(formData.entries())) {
        if (typeof v === 'string') {
          if (isSensitiveFieldName(k, formElement)) continue;
          if (allowedVaryFields && !allowedVaryFields.has(k.toLowerCase())) continue;
          if (!seenKeys.has(k)) {
            params.delete(k);
            seenKeys.add(k);
          }
          params.append(k, v);
        }
      }
    } catch {
      // Ignore FormData read errors on detached forms
    }
  }

  const sortedEntries = Array.from(params.entries()).sort(
    ([aK, aV], [bK, bV]) => aK.localeCompare(bK) || aV.localeCompare(bV),
  );

  const canonicalParams = new URLSearchParams();
  for (const [k, v] of sortedEntries) {
    canonicalParams.append(k, v);
  }

  const qStr = canonicalParams.toString();
  return `${method}:${basePath}${qStr ? `?${qStr}` : ''}`;
}

function isSensitiveFieldName(name: string, form: HTMLFormElement | null): boolean {
  const lower = name.toLowerCase();
  if (
    lower.includes('password') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('auth') ||
    lower.includes('creditcard') ||
    lower.includes('cvv')
  ) {
    return true;
  }
  if (form) {
    const input = findNamedInput(form, name);
    if (input && input.type.toLowerCase() === 'password') {
      return true;
    }
  }
  return false;
}

function findNamedInput(form: HTMLFormElement, name: string): HTMLInputElement | null {
  const namedItem = form.elements.namedItem(name);
  if (namedItem instanceof HTMLInputElement) return namedItem;
  if (typeof RadioNodeList !== 'undefined' && namedItem instanceof RadioNodeList) {
    const item = namedItem.item(0);
    if (item instanceof HTMLInputElement) return item;
  }
  const unindexedName = name.replace(/\[\d+\]$/, '');
  const unindexedItem = form.elements.namedItem(unindexedName);
  if (unindexedItem instanceof HTMLInputElement) return unindexedItem;
  return null;
}

function normalizeInvalidationPattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (trimmed.startsWith('GET:')) return trimmed;
  if (trimmed.includes(':') && !trimmed.startsWith('/')) return trimmed;
  return `GET:${trimmed}`;
}

export type HtmxInstance = {
  swap?: (opts: { target: Element; text: string; swap?: string }) => void;
};
