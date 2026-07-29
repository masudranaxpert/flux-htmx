import { queryAllSafely } from '../core/selectors.js';
import { log } from '../core/logger.js';

export function installAccordion() {
  document.addEventListener('click', handleAccordionClick);
}

function handleAccordionClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const trigger = target.closest('[fx-disclosure-trigger]');
  if (trigger) {
    const disclosure = trigger.closest('[fx-disclosure]');
    if (!disclosure) {
      log.warn('fx-disclosure-trigger must be inside an fx-disclosure element');
      return;
    }

    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    
    const accordion = disclosure.closest('[fx-accordion]');
    const isMultiple = accordion && accordion.getAttribute('fx-accordion') === 'multiple';

    if (!isExpanded) {
      if (accordion && !isMultiple) {
        // Close other disclosures in the same accordion
        const siblings = queryAllSafely('[fx-disclosure]', accordion);
        for (const sibling of siblings) {
          if (sibling !== disclosure) {
            closeDisclosure(sibling);
          }
        }
      }
      openDisclosure(disclosure, trigger as HTMLElement);
    } else {
      closeDisclosure(disclosure, trigger as HTMLElement);
    }
  }
}

function openDisclosure(disclosure: Element, trigger?: HTMLElement) {
  disclosure.setAttribute('fx-open', '');
  const t = trigger || disclosure.querySelector('[fx-disclosure-trigger]');
  if (t) {
    t.setAttribute('aria-expanded', 'true');
  }
  const panel = disclosure.querySelector('[fx-disclosure-panel]');
  if (panel) {
    panel.removeAttribute('hidden');
  }
}

function closeDisclosure(disclosure: Element, trigger?: HTMLElement) {
  disclosure.removeAttribute('fx-open');
  const t = trigger || disclosure.querySelector('[fx-disclosure-trigger]');
  if (t) {
    t.setAttribute('aria-expanded', 'false');
  }
  const panel = disclosure.querySelector('[fx-disclosure-panel]');
  if (panel) {
    panel.setAttribute('hidden', '');
  }
}
