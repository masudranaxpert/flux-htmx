if (typeof globalThis.CSSStyleSheet !== 'undefined') {
  globalThis.CSSStyleSheet.prototype.replaceSync = function () {};
  globalThis.CSSStyleSheet.prototype.replace = async function () {};
} else {
  (globalThis as any).CSSStyleSheet = class {
    replaceSync() {}
    replace() {}
  };
}

if (typeof document !== 'undefined') {
  if (!document.adoptedStyleSheets) {
    (document as any).adoptedStyleSheets = [];
  }
}

// Polyfill XPathExpression.prototype.evaluate for HTMX 4 JSDOM environment
if (typeof window !== 'undefined' && typeof XPathExpression !== 'undefined') {
  const origEval = XPathExpression.prototype.evaluate;
  XPathExpression.prototype.evaluate = function (node: Node, type?: number, result?: XPathResult) {
    return origEval.call(this, node, type ?? 0, result ?? null);
  };
}
