// HTMX event detail adapter. Provides a single canonical shape for HTMX event details across all modules.

export interface RequestContext {
  detail: Record<string, any>;
  ctx: Record<string, any>;
  request?: {
    method?: string;
    action?: string;
    headers?: unknown;
    parameters?: Record<string, unknown>;
    abort?: () => void;
  };
  source: Element | null;
  target: Element | null;
  status: number;
  text: string | null;
  successful: boolean;
  isCacheHit: boolean;
  isDedupeHit: boolean;
}

export function getRequestContext(event: Event): RequestContext {
  const detail = (event as CustomEvent).detail ?? {};
  const ctx = detail.ctx ?? {};
  const response = ctx.response ?? detail.response;
  const xhr = ctx.xhr ?? detail.xhr;

  const status = response?.status ?? xhr?.status ?? 0;
  const text = ctx.text ?? detail.text ?? response?.text ?? xhr?.responseText ?? null;
  const source =
    (ctx.sourceElement instanceof Element ? ctx.sourceElement : null) ??
    (detail.elt instanceof Element ? detail.elt : null);
  const target =
    (ctx.target instanceof Element ? ctx.target : null) ??
    (detail.target instanceof Element ? detail.target : null);

  const successful =
    ctx.successful === true || detail.successful === true
      ? true
      : ctx.successful === false || detail.successful === false
        ? false
        : typeof status === 'number' && status >= 200 && status < 300;

  const isCacheHit = Boolean(ctx.isCacheHit);
  const isDedupeHit = Boolean(ctx.isDedupeHit);

  return {
    detail,
    ctx,
    request: ctx.request,
    source,
    target,
    status,
    text,
    successful,
    isCacheHit,
    isDedupeHit,
  };
}
