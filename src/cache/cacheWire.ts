// Connects the fragment cache to HTMX's request lifecycle. A GET whose source carries
// fx-cache="60s" (or empty fx-cache) is served from cache when fresh and stored on fetch;
// a mutation whose source carries fx-invalidate clears matching keys after a successful response.
// Supports Stale-While-Revalidate (SWR) mode via fx-cache-mode="stale-while-revalidate".

import type { FragmentCache } from './cache.js';
import { isCacheableMethod } from './cache.js';
import { getRequestContext } from '../core/events.js';
import { log } from '../core/logger.js';

const CACHE_ATTR = 'fx-cache';
const CACHE_KEY_ATTR = 'fx-cache-key';
const CACHE_MODE_ATTR = 'fx-cache-mode';
const INVALIDATE_ATTR = 'fx-invalidate';
const VARY_ATTR = 'fx-cache-vary';

const SENSITIVE_FIELDS = new Set([
  'password',
  'pass',
  'csrfmiddlewaretoken',
  '_csrf',
  'authenticity_token',
  'csrf_token',
  'token',
]);

export interface CachePolicy {
  enabled: boolean;
  ttl?: number;
  swr: boolean;
}

export function getCachePolicy(element: Element): CachePolicy {
  if (!element.hasAttribute(CACHE_ATTR)) {
    return { enabled: false, swr: false };
  }

  const raw = element.getAttribute(CACHE_ATTR) ?? '';
  if (raw === 'false') {
    return { enabled: false, swr: false };
  }

  const mode = element.getAttribute(CACHE_MODE_ATTR);
  const swr = mode === 'stale-while-revalidate' || element.getAttribute('fx-cache-swr') === 'true';

  const ttl = parseTtl(raw);
  if (ttl === undefined) {
    log.warn(`invalid fx-cache TTL "${raw}" on element; disabling fragment cache`);
    return { enabled: false, swr: false };
  }

  return { enabled: true, ttl, swr };
}

function isSensitiveField(key: string, source?: Element): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_FIELDS.has(lower)) return true;
  if (source instanceof Element) {
    const inputs = Array.from(source.querySelectorAll('input'));
    for (const input of inputs) {
      if (input.getAttribute('name') === key && input.type === 'password') {
        return true;
      }
    }
  }
  return false;
}

function hasAuthorizationHeader(headers: unknown): boolean {
  if (!headers) return false;
  if (typeof (headers as any).get === 'function') {
    return Boolean((headers as any).get('Authorization') ?? (headers as any).get('authorization'));
  }
  if (typeof headers === 'object') {
    const record = headers as Record<string, unknown>;
    for (const [k, v] of Object.entries(record)) {
      if (k.toLowerCase() === 'authorization' && Boolean(v)) return true;
    }
  }
  return false;
}

function normalizeInvalidationPattern(pattern: string): string {
  return pattern.startsWith('GET:') ? pattern : `GET:${pattern}`;
}

interface HtmxInstance {
  swap?: (ctx: any) => any;
}

export function installCacheIntegration(
  cache: FragmentCache,
  htmxInstance?: HtmxInstance,
): () => void {
  if (typeof document === 'undefined') return () => {};

  // config:request: if a cached entry exists for this GET, swap it directly and abort the fetch unless in SWR mode.
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
      ctx.ctx.isCacheHit = true;
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

    const hasReqAuth = hasAuthorizationHeader(request.headers);
    const hasResAuth =
      hasAuthorizationHeader(ctx.ctx.response?.headers) || Boolean(getHeader('Authorization'));
    const hasAuthHeader = hasReqAuth || hasResAuth;

    const cacheControl = (getHeader('Cache-Control') ?? '').toLowerCase();
    const pragma = (getHeader('Pragma') ?? '').toLowerCase();
    const contentType = (getHeader('Content-Type') ?? '').toLowerCase();
    const rawVary = getHeader('Vary') ?? '';
    const varyTokens = rawVary.split(',').map((s) => s.trim().toLowerCase());

    const hasSetCookie = Boolean(getHeader('Set-Cookie'));
    const isNoStore =
      cacheControl.includes('no-store') ||
      cacheControl.includes('private') ||
      cacheControl.includes('no-cache') ||
      cacheControl.includes('max-age=0') ||
      cacheControl.includes('s-maxage=0') ||
      pragma.includes('no-cache');

    const isHtmlContent =
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml') ||
      contentType === '';
    const isPersonalizedVary =
      varyTokens.includes('*') ||
      varyTokens.includes('cookie') ||
      varyTokens.includes('authorization');

    if (
      policy.enabled &&
      policy.ttl !== undefined &&
      isCacheableMethod(request.method ?? 'GET') &&
      text !== null &&
      text !== undefined &&
      successful &&
      !is204 &&
      !isNoStore &&
      !hasSetCookie &&
      isHtmlContent &&
      !isPersonalizedVary &&
      !hasAuthHeader
    ) {
      const key = cacheKey(source, request);
      cache.set(key, text, policy.ttl);
    }

    // Mutation invalidation (only on successful mutation)
    if (
      successful &&
      !isCacheableMethod(request.method ?? 'GET') &&
      source.hasAttribute(INVALIDATE_ATTR)
    ) {
      const spec = source.getAttribute(INVALIDATE_ATTR) ?? '';
      for (const part of spec.split(/\s+/).filter(Boolean)) {
        const normalized = normalizeInvalidationPattern(part);
        if (part.includes('*')) {
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

function cacheKey(
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

  const params = new URLSearchParams();
  let basePath = canonicalPath;

  if (rawAction.includes('?')) {
    const qIndex = rawAction.indexOf('?');
    const existingParams = new URLSearchParams(rawAction.slice(qIndex + 1));
    for (const [k, v] of existingParams.entries()) {
      params.append(k, v);
    }
  }

  if (request.parameters) {
    for (const [k, v] of Object.entries(request.parameters)) {
      if (v !== undefined && v !== null) {
        params.delete(k);
        if (Array.isArray(v)) {
          for (const item of v) params.append(k, String(item));
        } else {
          params.append(k, String(v));
        }
      }
    }
  } else {
    const form = source instanceof HTMLFormElement ? source : source.closest('form');
    if (form instanceof HTMLFormElement) {
      const formData = new FormData(form);
      const seen = new Set<string>();
      for (const [k, v] of formData.entries()) {
        if (!seen.has(k)) {
          params.delete(k);
          seen.add(k);
        }
        if (typeof v === 'string') params.append(k, v);
      }
    } else if (
      source instanceof HTMLInputElement ||
      source instanceof HTMLSelectElement ||
      source instanceof HTMLTextAreaElement
    ) {
      if (
        source instanceof HTMLInputElement &&
        (source.type === 'checkbox' || source.type === 'radio')
      ) {
        if (source.checked && source.name && source.value) {
          params.delete(source.name);
          params.append(source.name, source.value);
        }
      } else if (source.name && source.value) {
        params.delete(source.name);
        params.append(source.name, source.value);
      }
    }
  }

  const varyAttr = source.getAttribute(VARY_ATTR);
  const varyFields = varyAttr
    ? new Set(
        varyAttr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;

  const sortedEntries = Array.from(params.entries())
    .filter(([k]) => {
      const allowedByVary = !varyFields || varyFields.has(k);
      return allowedByVary && !isSensitiveField(k, source);
    })
    .sort(([aKey, aVal], [bKey, bVal]) => aKey.localeCompare(bKey) || aVal.localeCompare(bVal));

  const canonicalParams = new URLSearchParams();
  for (const [k, v] of sortedEntries) canonicalParams.append(k, v);

  const queryString = canonicalParams.toString();
  const url = queryString ? `${basePath}?${queryString}` : basePath;

  return `${method}:${url}`;
}

function parseTtl(value: string, defaultTtlMs = 60_000): number | undefined {
  if (!value || value === 'true') return defaultTtlMs;
  if (value === 'false') return undefined;
  const match = /^(\d+)(ms|s|m)?$/.exec(value.trim());
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = match[2] ?? 'ms';
  const multiplier = unit === 'ms' ? 1 : unit === 's' ? 1000 : 60_000;
  return n * multiplier;
}
