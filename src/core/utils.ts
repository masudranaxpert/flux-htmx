// Core shared utility helpers for strict status checking and safe DOM queries.

import { log } from './logger.js';

export interface HtmxDetail {
  ctx?: {
    successful?: boolean;
    response?: { status?: number };
    xhr?: { status?: number };
  };
  xhr?: { status?: number };
}

/** Strictly checks whether an HTMX request context resulted in an HTTP 2xx success. */
export function isSuccessfulRequest(detail?: HtmxDetail | null): boolean {
  if (!detail) return false;
  if (detail.ctx?.successful === true) return true;

  const status = detail.ctx?.response?.status ?? detail.ctx?.xhr?.status ?? detail.xhr?.status;
  return typeof status === 'number' && status >= 200 && status < 300;
}

/** Safely executes querySelectorAll without throwing DOMExceptions on invalid selector syntax. */
export function queryAllSafely<T extends Element = Element>(
  root: ParentNode,
  selector: string,
): T[] {
  if (!selector || typeof selector !== 'string') return [];
  try {
    return Array.from(root.querySelectorAll<T>(selector));
  } catch (e) {
    log.warn(`invalid CSS selector "${selector}":`, e);
    return [];
  }
}
