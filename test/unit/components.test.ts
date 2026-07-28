import { describe, expect, it, beforeEach, vi } from 'vitest';
import { installOpenController, createToastRegion } from '../../src/components/components.js';

describe('fx-open controller', () => {
  let teardown: () => void;

  beforeEach(() => {
    teardown = installOpenController();
  });

  it('opens a <dialog> via showModal and focuses inside it', () => {
    document.body.innerHTML = `
      <button fx-open="#dlg">Open</button>
      <dialog id="dlg"><button id="inside">OK</button></dialog>`;
    const dialog = document.getElementById('dlg') as HTMLDialogElement;
    // jsdom does not implement showModal; stub it to assert the controller calls it.
    const showSpy = vi.fn();
    dialog.showModal = showSpy;

    document.querySelector('[fx-open]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(showSpy).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('inside');
    teardown();
  });

  it('does nothing when the selector matches no dialog', () => {
    document.body.innerHTML = `<button fx-open="#missing">x</button>`;
    expect(() =>
      document
        .querySelector('[fx-open]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow();
    teardown();
  });
});

describe('createToastRegion', () => {
  it('creates an accessible region attached to body', () => {
    const region = createToastRegion();
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Notifications');
    expect(document.body.contains(region)).toBe(true);
  });
});
