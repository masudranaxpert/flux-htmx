// CSRF token resolution. See docs/security.md for the security model: tokens are applied
// only to same-origin mutations, never logged, and never sent cross-origin.

import type { CsrfConfig } from './config.js';

export interface CsrfToken {
  headerName: string;
  value: string | null;
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutation(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;

  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      const rawValue = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
}

export function readMeta(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const metas = document.querySelectorAll('meta[name]');
  for (const meta of Array.from(metas)) {
    if (meta.getAttribute('name') === name) {
      const content = meta.getAttribute('content');
      return content && content.length > 0 ? content : null;
    }
  }
  return null;
}

/** Resolves the current token per `config` without deciding whether to send it. */
export function resolveToken(cfg: CsrfConfig): CsrfToken {
  let value: string | null = null;

  if (cfg.strategy === 'meta' && cfg.metaName) {
    value = readMeta(cfg.metaName);
  } else if (cfg.strategy === 'cookie' && cfg.cookieName) {
    value = readCookie(cfg.cookieName);
  }

  return { headerName: cfg.headerName ?? 'X-CSRFToken', value };
}

export function shouldAttach(method: string, url: string, token: CsrfToken): boolean {
  return Boolean(token.value) && isMutation(method) && isSameOrigin(url);
}

export function isSameOrigin(url: string): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
