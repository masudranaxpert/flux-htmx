// Safe DOM selector utility module. Prevents DOMException crashes on invalid CSS selector syntax.

import { log } from './logger.js';

export function queryOne(
  selector: string | null | undefined,
  root: ParentNode = document,
): Element | null {
  if (!selector || typeof selector !== 'string') return null;
  try {
    return root.querySelector(selector);
  } catch (error) {
    log.warn(`invalid CSS selector "${selector}":`, error);
    return null;
  }
}

export function queryMany(
  selector: string | null | undefined,
  root: ParentNode = document,
): Element[] {
  if (!selector || typeof selector !== 'string') return [];
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    log.warn(`invalid CSS selector "${selector}":`, error);
    return [];
  }
}

export const queryAllSafely = queryMany;

export function safeQuerySelector(selector: string, context?: Element | Document): Element | null {
  return queryOne(selector, context ?? document);
}

export function safeClosest(
  element: Element | null | undefined,
  selector: string | null | undefined,
): Element | null {
  if (!element || !selector || typeof selector !== 'string') return null;
  try {
    return element.closest(selector);
  } catch (error) {
    log.warn(`invalid closest selector "${selector}":`, error);
    return null;
  }
}
