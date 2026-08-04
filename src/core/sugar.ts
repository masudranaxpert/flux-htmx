// surreal-inspired DOM manipulation (LoB)
// https://github.com/gnat/surreal

export type NodeOrList = Node | NodeList | Array<Node>;

function isNode(e: any): e is Node {
  return e instanceof Node || e instanceof Document;
}

function isNodeList(e: any): e is NodeList | Array<Node> {
  return e instanceof NodeList || Array.isArray(e);
}

// Ensure elements get the sugar methods.
export function sugar<T extends NodeOrList>(e: T): T & Sugared {
  if (!e) return e as any;
  if (isNodeList(e)) {
    e.forEach((el) => sugar(el));
  }
  
  // If it's a node and doesn't already have sugar
  if (isNode(e) && !(e as any).hasSurreal) {
    const el = e as any;
    
    el.run = (f: (el: any) => void) => run(el, f);
    el.remove = () => remove(el);
    el.classAdd = (name: string) => classAdd(el, name);
    el.classRemove = (name: string) => classRemove(el, name);
    el.classToggle = (name: string, force?: boolean) => classToggle(el, name, force);
    el.styles = (value: string | Record<string, string>) => styles(el, value);
    el.on = (name: string, f: EventListener) => on(el, name, f);
    el.off = (name: string, f: EventListener) => off(el, name, f);
    el.offAll = () => offAll(el);
    el.disable = () => disable(el);
    el.enable = () => enable(el);
    el.send = (name: string, detail?: any) => send(el, name, detail);
    el.attribute = (name: string | Record<string, any>, value?: any) => attribute(el, name, value);
    el.fadeOut = (f?: (el: any) => void, ms?: number, removeEl?: boolean) => fadeOut(el, f, ms, removeEl);
    el.fadeIn = (f?: (el: any) => void, ms?: number) => fadeIn(el, f, ms);
    
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
  remove(): void;
  classAdd(name: string): this;
  addClass(name: string): this;
  classRemove(name: string): this;
  removeClass(name: string): this;
  classToggle(name: string, force?: boolean): this;
  toggleClass(name: string, force?: boolean): this;
  styles(value: string | Record<string, string>): this;
  on(name: string, f: EventListener): this;
  off(name: string, f: EventListener): this;
  offAll(): this;
  disable(): this;
  enable(): this;
  send(name: string, detail?: any): this;
  trigger(name: string, detail?: any): this;
  attribute(name: string | Record<string, any>, value?: any): this | string | null;
  attr(name: string | Record<string, any>, value?: any): this | string | null;
  fadeOut(f?: (el: this) => void, ms?: number, removeEl?: boolean): this;
  fadeIn(f?: (el: this) => void, ms?: number): this;
}

export function me(selector: string | Event | Element | null = null, start: Document | Element = document, warning = true): (Element & Sugared) | null {
  if (selector == null) {
    if (document.currentScript && document.currentScript.parentElement) {
      return sugar(document.currentScript.parentElement) as any;
    }
    return null;
  }
  if (selector instanceof Event) {
    return selector.currentTarget ? me(selector.currentTarget as Element) : null;
  }
  if (selector === '-' || selector === 'prev' || selector === 'previous') {
    if (document.currentScript && document.currentScript.previousElementSibling) {
      return sugar(document.currentScript.previousElementSibling) as any;
    }
    return null;
  }
  if (typeof selector === 'string') {
    if (isSelector(selector, start, warning)) {
      return sugar(start.querySelector(selector)!) as any;
    }
    return null;
  }
  if (isNodeList(selector)) {
    return me((selector as any)[0]);
  }
  if (isNode(selector)) {
    return sugar(selector as Node) as any;
  }
  return null;
}

export function any(selector: string | Event | Element | null | NodeList, start: Document | Element = document, warning = true): (Element & Sugared)[] {
  if (selector == null) {
    if (document.currentScript && document.currentScript.parentElement) {
      return sugar([document.currentScript.parentElement]) as any;
    }
    return sugar([]) as any;
  }
  if (selector instanceof Event) {
    return selector.currentTarget ? any(selector.currentTarget as Element) : sugar([]) as any;
  }
  if (selector === '-' || selector === 'prev' || selector === 'previous') {
    if (document.currentScript && document.currentScript.previousElementSibling) {
      return sugar([document.currentScript.previousElementSibling]) as any;
    }
    return sugar([]) as any;
  }
  if (typeof selector === 'string') {
    if (isSelector(selector, start, warning)) {
      return sugar(Array.from(start.querySelectorAll(selector))) as any;
    }
    return sugar([]) as any;
  }
  if (isNode(selector)) {
    return sugar([selector as Node]) as any;
  }
  if (isNodeList(selector)) {
    return sugar(Array.from(selector as NodeList)) as any;
  }
  return sugar([]) as any;
}

function run(e: any, f: any) {
  if (typeof f !== 'function') return e;
  if (isNodeList(e)) e.forEach((_: any) => run(_, f));
  if (isNode(e)) f(e);
  return e;
}

function remove(e: any) {
  if (isNodeList(e)) e.forEach((_: any) => remove(_));
  if (isNode(e) && e.parentNode) e.parentNode.removeChild(e);
}

function classAdd(e: any, name: string) {
  if (typeof name !== 'string') return e;
  if (name.charAt(0) === '.') name = name.substring(1);
  if (isNodeList(e)) e.forEach((_: any) => classAdd(_, name));
  if (isNode(e) && 'classList' in e) (e as Element).classList.add(name);
  return e;
}

function classRemove(e: any, name: string) {
  if (typeof name !== 'string') return e;
  if (name.charAt(0) === '.') name = name.substring(1);
  if (isNodeList(e)) e.forEach((_: any) => classRemove(_, name));
  if (isNode(e) && 'classList' in e) (e as Element).classList.remove(name);
  return e;
}

function classToggle(e: any, name: string, force?: boolean) {
  if (typeof name !== 'string') return e;
  if (name.charAt(0) === '.') name = name.substring(1);
  if (isNodeList(e)) e.forEach((_: any) => classToggle(_, name, force));
  if (isNode(e) && 'classList' in e) (e as Element).classList.toggle(name, force);
  return e;
}

function styles(e: any, value: string | Record<string, string>) {
  if (typeof value === 'string') {
    if (isNodeList(e)) e.forEach((_: any) => styles(_, value));
    if (isNode(e)) attribute(e, 'style', (attribute(e, 'style') || '') + '; ' + value);
    return e;
  }
  if (typeof value === 'object') {
    if (isNodeList(e)) e.forEach((_: any) => styles(_, value));
    if (isNode(e) && 'style' in e) Object.assign((e as HTMLElement).style, value);
    return e;
  }
  return e;
}

function on(e: any, name: string, f: EventListener) {
  if (isNodeList(e)) e.forEach((_: any) => on(_, name, f));
  if (isNode(e) && 'addEventListener' in e) e.addEventListener(name, f);
  return e;
}

function off(e: any, name: string, f: EventListener) {
  if (isNodeList(e)) e.forEach((_: any) => off(_, name, f));
  if (isNode(e) && 'removeEventListener' in e) e.removeEventListener(name, f);
  return e;
}

function offAll(e: any) {
  if (isNodeList(e)) e.forEach((_: any) => offAll(_));
  if (isNode(e) && e.parentNode) e.parentNode.replaceChild(e.cloneNode(true), e);
  return e;
}

function disable(e: any) {
  if (isNodeList(e)) e.forEach((_: any) => disable(_));
  if (isNode(e)) (e as any).disabled = true;
  return e;
}

function enable(e: any) {
  if (isNodeList(e)) e.forEach((_: any) => enable(_));
  if (isNode(e)) (e as any).disabled = false;
  return e;
}

function send(e: any, name: string, detail: any = null) {
  if (isNodeList(e)) e.forEach((_: any) => send(_, name, detail));
  if (isNode(e) && 'dispatchEvent' in e) {
    const event = new CustomEvent(name, { detail, bubbles: true });
    e.dispatchEvent(event);
  }
  return e;
}

function attribute(e: any, name: string | Record<string, any>, value?: any) {
  if (typeof name === 'string' && value === undefined) {
    if (isNodeList(e)) return [];
    if (isNode(e) && 'getAttribute' in e) return (e as Element).getAttribute(name);
    return null;
  }
  if (typeof name === 'string' && value === null) {
    if (isNodeList(e)) e.forEach((_: any) => attribute(_, name, value));
    if (isNode(e) && 'removeAttribute' in e) (e as Element).removeAttribute(name);
    return e;
  }
  if (typeof name === 'string') {
    if (isNodeList(e)) e.forEach((_: any) => attribute(_, name, value));
    if (isNode(e) && 'setAttribute' in e) (e as Element).setAttribute(name, value);
    return e;
  }
  if (typeof name === 'object') {
    if (isNodeList(e)) e.forEach((_: any) => {
      Object.entries(name).forEach(([key, val]) => attribute(_, key, val));
    });
    if (isNode(e)) {
      Object.entries(name).forEach(([key, val]) => attribute(e, key, val));
    }
    return e;
  }
  return e;
}

function isSelector(selector: string, start: Document | Element = document, _warning = true) {
  if (typeof selector !== 'string') return false;
  try {
    if (start.querySelector(selector) == null) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function tick() {
  return await new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

export async function sleep(ms: number, e?: any) {
  return await new Promise((resolve) => setTimeout(() => { resolve(e); }, ms));
}

function fadeOut(e: any, f?: (el: any) => void, ms = 250, removeEl = false) {
  if (isNodeList(e)) {
    e.forEach((_: any) => fadeOut(_, f, ms, removeEl));
    return e;
  }
  if (isNode(e)) {
    (async () => {
      styles(e, { transition: `opacity ${ms}ms ease-out`, overflow: 'hidden' });
      await tick();
      styles(e, { opacity: '0' });
      await sleep(ms, e);
      if (removeEl) {
        remove(e);
      } else {
        classAdd(e, 'hidden');
        styles(e, { display: 'none' });
      }
      if (typeof f === 'function') f(e);
    })();
  }
  return e;
}

function fadeIn(e: any, f?: (el: any) => void, ms = 250) {
  if (isNodeList(e)) {
    e.forEach((_: any) => fadeIn(_, f, ms));
    return e;
  }
  if (isNode(e)) {
    (async () => {
      classRemove(e, 'hidden');
      if ((e as HTMLElement).style.display === 'none') {
        (e as HTMLElement).style.display = '';
      }
      // Restore only the fade props; a cssText wipe would clobber unrelated inline styles.
      const s = (e as HTMLElement).style;
      const prev = { opacity: s.opacity, transition: s.transition, overflow: s.overflow };
      styles(e, { opacity: '0', transition: `opacity ${ms}ms ease-in`, overflow: 'hidden' });
      await tick();
      styles(e, { opacity: '1' });
      await sleep(ms, e);
      styles(e, prev);
      if (typeof f === 'function') f(e);
    })();
  }
  return e;
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

