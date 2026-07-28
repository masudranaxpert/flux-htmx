// Unified Controller Registry. Manages active controller teardowns across modules with a clean interface.

export type Teardown = () => void;

export class ControllerRegistry {
  private controllers = new Map<string, WeakMap<Element, Teardown>>();
  private cleanups = new Set<Teardown>();

  connect(type: string, element: Element, setup: () => Teardown): Teardown {
    const map = this.controllers.get(type) ?? new WeakMap<Element, Teardown>();

    // Cleanup any existing controller on this element for this type
    map.get(element)?.();

    const cleanup = setup();

    const wrappedTeardown = () => {
      cleanup();
      map.delete(element);
      this.cleanups.delete(wrappedTeardown);
    };

    map.set(element, wrappedTeardown);
    this.controllers.set(type, map);
    this.cleanups.add(wrappedTeardown);

    return wrappedTeardown;
  }

  has(type: string, element: Element): boolean {
    return this.controllers.get(type)?.has(element) ?? false;
  }

  disconnect(type: string, element: Element): void {
    const map = this.controllers.get(type);
    if (map) {
      map.get(element)?.();
    }
  }

  disposeAll(): void {
    for (const cleanup of Array.from(this.cleanups)) {
      cleanup();
    }
    this.cleanups.clear();
  }
}

export const registry = new ControllerRegistry();
