// Surreal-inspired DOM manipulation (Locality of Behaviour).
// https://github.com/gnat/surreal
//
// The sugared methods are thin, faithful delegates of the native platform APIs
// (classList, addEventListener, attributes, dispatchEvent, Element.remove) plus the
// selector ergonomics of me()/any(). Nothing here patches prototypes or clones nodes.

export type NodeOrList = Node | NodeList | Array<Node>;

function isNode(e: unknown): e is Node {
  return e instanceof Node || e instanceof Document;
}

function isNodeList(e: unknown): e is NodeList | Array<Node> {
  return e instanceof NodeList || Array.isArray(e);
}

/** Runs `fn` once per node; accepts a single node or a list. */
function apply(e: unknown, fn: (el: Node) => void): void {
  if (isNodeList(e)) {
    for (const el of e) fn(el);
  } else if (isNode(e)) {
    fn(e);
  }
}

/** Strips a leading `.` so `classAdd('.foo')` and `classAdd('foo')` are the same. */
function className(name: unknown): string {
  const str = String(name);
  return str.charAt(0) === '.' ? str.slice(1) : str;
}

// Ensure elements get the sugar methods.
export function sugar<T extends NodeOrList>(e: T): T & Sugared {
  if (!e) return e as any;
  if (isNodeList(e)) {
    e.forEach((el) => sugar(el));
    return e as T & Sugared;
  }
  if (isNode(e) && !(e as any).hasSurreal) {
    const el = e as any;

    el.run = (f: (node: any) => void) => {
      if (typeof f === 'function') f(el);
      return el;
    };
    el.remove = () => {
      el.parentNode?.removeChild(el);
      return el;
    };
    el.classAdd = (name: string) => {
      apply(el, (n) => (n as Element).classList?.add(className(name)));
      return el;
    };
    el.classRemove = (name: string) => {
      apply(el, (n) => (n as Element).classList?.remove(className(name)));
      return el;
    };
    el.classToggle = (name: string, force?: boolean) => {
      apply(el, (n) => (n as Element).classList?.toggle(className(name), force));
      return el;
    };
    el.styles = (value: string | Record<string, string>) => {
      const style = (el as HTMLElement).style;
      if (!style) return el;
      if (typeof value === 'string') {
        style.cssText += `; ${value}`;
      } else {
        Object.assign(style, value);
      }
      return el;
    };
    el.on = (name: string, f: EventListener) => {
      el.addEventListener(name, f);
      return el;
    };
    el.off = (name: string, f: EventListener) => {
      el.removeEventListener(name, f);
      return el;
    };
    el.disable = () => {
      el.disabled = true;
      return el;
    };
    el.enable = () => {
      el.disabled = false;
      return el;
    };
    el.send = (name: string, detail: unknown = null) => {
      el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
      return el;
    };
    el.attribute = (name: string | Record<string, unknown>, value?: unknown) => {
      if (typeof name === 'object') {
        for (const [key, val] of Object.entries(name)) {
          (el as Element).setAttribute(key, String(val));
        }
        return el;
      }
      if (value === undefined) return (el as Element).getAttribute(name);
      if (value === null) {
        (el as Element).removeAttribute(name);
        return el;
      }
      (el as Element).setAttribute(name, String(value));
      return el;
    };
    el.fadeOut = (f?: (node: any) => void, ms = 250, removeEl = false) => {
      void fadeOut(el, f, ms, removeEl);
      return el;
    };
    el.fadeIn = (f?: (node: any) => void, ms = 250) => {
      void fadeIn(el, f, ms);
      return el;
    };

    // aliases
    el.addClass = el.classAdd;
    el.removeClass = el.classRemove;
    el.toggleClass = el.classToggle;
    el.attr = el.attribute;
    el.trigger = el.send;

    el.hasSurreal = true;
  }
  return e as T & Sugared;
}

export interface Sugared {
  run(f: (el: this) => void): this;
  remove(): this;
  classAdd(name: string): this;
  addClass(name: string): this;
  classRemove(name: string): this;
  removeClass(name: string): this;
  classToggle(name: string, force?: boolean): this;
  toggleClass(name: string, force?: boolean): this;
  styles(value: string | Record<string, string>): this;
  on(name: string, f: EventListener): this;
  off(name: string, f: EventListener): this;
  disable(): this;
  enable(): this;
  send(name: string, detail?: unknown): this;
  trigger(name: string, detail?: unknown): this;
  attribute(name: string, value?: unknown): this;
  attribute(name: string | Record<string, unknown>, value?: unknown): this | string | null;
  attr(name: string | Record<string, unknown>, value?: unknown): this | string | null;
  fadeOut(f?: (el: this) => void, ms?: number, removeEl?: boolean): this;
  fadeIn(f?: (el: this) => void, ms?: number): this;
}

/** The script's parent element (or `#id`, `Event.currentTarget`, an element, `-` for prev). */
export function me(
  selector: string | Event | Element | null = null,
  start: Document | Element = document,
): (Element & Sugared) | null {
  if (selector == null) {
    return document.currentScript?.parentElement
      ? (sugar(document.currentScript.parentElement) as any)
      : null;
  }
  if (selector instanceof Event) {
    return selector.currentTarget ? me(selector.currentTarget as Element) : null;
  }
  if (selector === '-' || selector === 'prev' || selector === 'previous') {
    return document.currentScript?.previousElementSibling
      ? (sugar(document.currentScript.previousElementSibling) as any)
      : null;
  }
  if (typeof selector === 'string') {
    try {
      return start.querySelector(selector) ? (sugar(start.querySelector(selector)!) as any) : null;
    } catch {
      return null;
    }
  }
  if (isNodeList(selector)) return me((selector as any)[0]);
  if (isNode(selector)) return sugar(selector as Node) as any;
  return null;
}

/** All elements matching the selector (same shortcuts as `me`). */
export function any(
  selector: string | Event | Element | null | NodeList,
  start: Document | Element = document,
): (Element & Sugared)[] {
  const empty: Element[] = [];
  if (selector == null) {
    return document.currentScript?.parentElement
      ? (sugar([document.currentScript.parentElement]) as any)
      : (sugar(empty) as any);
  }
  if (selector instanceof Event) {
    return selector.currentTarget ? any(selector.currentTarget as Element) : (sugar(empty) as any);
  }
  if (selector === '-' || selector === 'prev' || selector === 'previous') {
    return document.currentScript?.previousElementSibling
      ? (sugar([document.currentScript.previousElementSibling]) as any)
      : (sugar(empty) as any);
  }
  if (typeof selector === 'string') {
    try {
      return sugar(Array.from(start.querySelectorAll(selector))) as any;
    } catch {
      return sugar(empty) as any;
    }
  }
  if (isNode(selector)) return sugar([selector as Node]) as any;
  if (isNodeList(selector)) return sugar(Array.from(selector as NodeList)) as any;
  return sugar(empty) as any;
}

// Executor form on purpose: Promise.withResolvers() is missing in Node 20's jsdom
// and older browser engines this library supports (CI runs Node 20).
export async function tick(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function sleep<T = void>(ms: number, value?: T): Promise<T | undefined> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  return value;
}

async function fadeOut(e: any, f?: (el: any) => void, ms = 250, removeEl = false): Promise<void> {
  if (!isNode(e)) return;
  const style = (e as HTMLElement).style;
  style.transition = `opacity ${ms}ms ease-out`;
  style.overflow = 'hidden';
  await tick();
  style.opacity = '0';
  await sleep(ms);
  if (removeEl) {
    e.parentNode?.removeChild(e);
  } else {
    (e as Element).classList.add('hidden');
    style.display = 'none';
  }
  if (typeof f === 'function') f(e);
}

async function fadeIn(e: any, f?: (el: any) => void, ms = 250): Promise<void> {
  if (!isNode(e)) return;
  const el = e as HTMLElement;
  el.classList.remove('hidden');
  if (el.style.display === 'none') el.style.display = '';
  // Restore only the fade props; a cssText wipe would clobber unrelated inline styles.
  const prev = {
    opacity: el.style.opacity,
    transition: el.style.transition,
    overflow: el.style.overflow,
  };
  el.style.opacity = '0';
  el.style.transition = `opacity ${ms}ms ease-in`;
  el.style.overflow = 'hidden';
  await tick();
  el.style.opacity = '1';
  await sleep(ms);
  el.style.opacity = prev.opacity;
  el.style.transition = prev.transition;
  el.style.overflow = prev.overflow;
  if (typeof f === 'function') f(e);
}

export function installDomSugar() {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (!w.me) w.me = me;
    if (!w.any) w.any = any;
    if (!w.tick) w.tick = tick;
    if (!w.sleep) w.sleep = sleep;

    // Add me and any to document as well (like Surreal does)
    if (!(document as any).me) (document as any).me = me;
    if (!(document as any).any) (document as any).any = any;
  }
}
