import { queryAllSafely } from '../core/selectors.js';
import { log } from '../core/logger.js';

export function installTabs(): () => void {
  document.addEventListener('click', handleTabClick);
  document.addEventListener('keydown', handleTabKeydown);
  return () => {
    document.removeEventListener('click', handleTabClick);
    document.removeEventListener('keydown', handleTabKeydown);
  };
}

function handleTabClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const tab = target.closest('[fx-tab]');
  if (tab) {
    const tabsContainer = tab.closest('[fx-tabs]');
    if (!tabsContainer) {
      log.warn('fx-tab must be inside an fx-tabs element');
      return;
    }
    const tabId = tab.getAttribute('fx-tab');
    if (tabId) {
      activateTab(tabsContainer, tabId);
    }
  }
}

function handleTabKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const target = e.target as HTMLElement;
    const tab = target.closest('[fx-tab]') as HTMLElement;
    if (!tab) return;

    const tabsContainer = tab.closest('[fx-tabs]');
    if (!tabsContainer) return;

    const allTabs = Array.from(queryAllSafely('[fx-tab]', tabsContainer)) as HTMLElement[];
    const index = allTabs.indexOf(tab);
    if (index > -1) {
      let nextIndex = e.key === 'ArrowRight' ? index + 1 : index - 1;
      if (nextIndex >= allTabs.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = allTabs.length - 1;

      const nextTab = allTabs[nextIndex];
      if (!nextTab) return;
      const nextTabId = nextTab.getAttribute('fx-tab');
      if (nextTabId) {
        activateTab(tabsContainer, nextTabId);
        nextTab.focus();
      }
    }
  }
}

function activateTab(container: Element, tabId: string) {
  // Update tabs
  const allTabs = queryAllSafely('[fx-tab]', container);
  for (const tab of allTabs) {
    if (tab.getAttribute('fx-tab') === tabId) {
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
    } else {
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    }
  }

  // Update panels
  const allPanels = queryAllSafely('[fx-panel]', container);
  for (const panel of allPanels) {
    if (panel.getAttribute('fx-panel') === tabId) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  }
}
