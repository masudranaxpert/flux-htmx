import { executePipeline } from './actions.js';
import { getRequestContext } from './events.js';

export function installActionPipeline(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onAfterRequest = async (evt: Event) => {
    const ctx = getRequestContext(evt);
    const element = ctx.source;

    if (!element) return;

    if (ctx.successful) {
      const successPipeline = element.getAttribute('fx-on-success');
      if (successPipeline) {
        await executePipeline(successPipeline, element, ctx.detail);
      }
    } else {
      const errorPipeline = element.getAttribute('fx-on-error');
      if (errorPipeline) {
        await executePipeline(errorPipeline, element, ctx.detail);
      }
    }
  };

  document.addEventListener('htmx:after:request', onAfterRequest);
  return () => {
    document.removeEventListener('htmx:after:request', onAfterRequest);
  };
}
