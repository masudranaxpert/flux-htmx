export function installTransitions(): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.hasAttribute('fx-transition') || el.querySelector('[fx-transition]')) {
              applyEnterTransition(el);
            }
          }
        });
      }
    }
  });

  // A script in <head> (or a moved script) runs before <body> exists; observing the
  // document root instead of throwing keeps bootstrap from dying silently.
  const root = document.body ?? document.documentElement;
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function applyEnterTransition(node: HTMLElement) {
  const targets = node.hasAttribute('fx-transition')
    ? [node]
    : (Array.from(node.querySelectorAll('[fx-transition]')) as HTMLElement[]);

  for (const el of targets) {
    const enterClass = el.getAttribute('fx-transition-enter') || 'fx-enter';
    const enterStartClass = el.getAttribute('fx-transition-enter-start') || 'fx-enter-start';
    const enterEndClass = el.getAttribute('fx-transition-enter-end') || 'fx-enter-end';

    // Initial state
    el.classList.add(enterClass, enterStartClass);

    // Next frame: switch to end state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.remove(enterStartClass);
        el.classList.add(enterEndClass);

        // Cleanup after transition ends
        const onEnd = (e: Event) => {
          if (e.target !== el) return;
          el.classList.remove(enterClass, enterEndClass);
          el.removeEventListener('transitionend', onEnd);
          el.removeEventListener('animationend', onEnd);
        };

        el.addEventListener('transitionend', onEnd);
        el.addEventListener('animationend', onEnd);
      });
    });
  }
}
