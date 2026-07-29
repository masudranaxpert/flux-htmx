import { executePipeline, executeAction, executeNamedPipeline } from './actions.js';

export function installActionPipeline(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onAfterRequest = async (evt: Event) => {
    const detail = (evt as CustomEvent).detail;
    if (!detail) return;
    const { elt, successful, failed } = detail;
    if (!elt) return;

    if (successful) {
      const successPipeline = elt.getAttribute('fx-on-success');
      if (successPipeline) {
        await executePipeline(successPipeline, elt, detail);
      }
      const successNamedAction = elt.getAttribute('fx-success-action');
      if (successNamedAction) {
        await executeNamedPipeline(successNamedAction, elt, detail);
      }
    }

    if (failed) {
      const errorPipeline = elt.getAttribute('fx-on-error');
      if (errorPipeline) {
        await executePipeline(errorPipeline, elt, detail);
      }
    }
  };

  document.addEventListener('htmx:afterRequest', onAfterRequest);
  return () => {
    document.removeEventListener('htmx:afterRequest', onAfterRequest);
  };
}
