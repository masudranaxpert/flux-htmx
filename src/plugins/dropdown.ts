import { queryAllSafely } from '../core/selectors.js';
import { log } from '../core/logger.js';

export function installDropdown() {
  document.addEventListener('click', handleDropdownClick);
  document.addEventListener('keydown', handleDropdownKeydown);
}

function handleDropdownClick(e: MouseEvent) {
  const target = e.target as HTMLElement;

  // Check if click was inside a trigger
  const trigger = target.closest('[fx-dropdown-trigger]');
  if (trigger) {
    const dropdown = trigger.closest('[fx-dropdown]');
    if (!dropdown) {
      log.warn('fx-dropdown-trigger must be inside an fx-dropdown element');
      return;
    }

    const isOpen = dropdown.hasAttribute('fx-open');
    if (isOpen) {
      closeDropdown(dropdown);
    } else {
      openDropdown(dropdown, trigger as HTMLElement);
    }
    return;
  }

  // Click outside handling
  const allOpenDropdowns = queryAllSafely(document, '[fx-dropdown][fx-open]');
  for (const dropdown of allOpenDropdowns) {
    if (!dropdown.contains(target)) {
      closeDropdown(dropdown);
    }
  }
}

function handleDropdownKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    const allOpenDropdowns = queryAllSafely(document, '[fx-dropdown][fx-open]');
    for (const dropdown of allOpenDropdowns) {
      closeDropdown(dropdown);
      // Restore focus to trigger
      const trigger = dropdown.querySelector('[fx-dropdown-trigger]') as HTMLElement;
      if (trigger) {
        trigger.focus();
      }
    }
  }
}

function openDropdown(dropdown: Element, trigger: HTMLElement) {
  dropdown.setAttribute('fx-open', '');
  trigger.setAttribute('aria-expanded', 'true');
  const menu = dropdown.querySelector('[fx-dropdown-menu]');
  if (menu) {
    menu.removeAttribute('hidden');
    // If we want transitions, we can integrate with fx-transition later
  }
}

function closeDropdown(dropdown: Element) {
  dropdown.removeAttribute('fx-open');
  const trigger = dropdown.querySelector('[fx-dropdown-trigger]');
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
  }
  const menu = dropdown.querySelector('[fx-dropdown-menu]');
  if (menu) {
    menu.setAttribute('hidden', '');
  }
}
