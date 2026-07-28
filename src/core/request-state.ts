// Request State Machine module. Provides setOutcomeState(element, state, status) and
// setLoadingState(element, isLoading) to manage state attributes without race conditions.

export type OutcomeState =
  | 'idle'
  | 'success'
  | 'http-error'
  | 'network-error'
  | 'timeout'
  | 'aborted';

const OUTCOME_ATTRIBUTES = [
  'data-flux-success',
  'data-flux-error',
  'data-flux-http-error',
  'data-flux-network-error',
  'data-flux-timeout',
  'data-flux-aborted',
];

export function clearOutcomeState(element: Element): void {
  for (const attr of OUTCOME_ATTRIBUTES) {
    element.removeAttribute(attr);
  }
}

export function setLoadingState(element: Element, isLoading: boolean): void {
  if (isLoading) {
    element.setAttribute('data-flux-loading', '1');
    clearOutcomeState(element);
  } else {
    element.removeAttribute('data-flux-loading');
  }
}

export function setOutcomeState(element: Element, state: OutcomeState, status?: number): void {
  clearOutcomeState(element);

  switch (state) {
    case 'success':
      element.setAttribute('data-flux-success', '1');
      break;

    case 'http-error':
      element.setAttribute('data-flux-error', '1');
      element.setAttribute('data-flux-http-error', String(status ?? 500));
      break;

    case 'network-error':
      element.setAttribute('data-flux-error', '1');
      element.setAttribute('data-flux-network-error', '1');
      break;

    case 'timeout':
      element.setAttribute('data-flux-error', '1');
      element.setAttribute('data-flux-timeout', '1');
      break;

    case 'aborted':
      element.setAttribute('data-flux-aborted', '1');
      break;

    case 'idle':
    default:
      break;
  }
}

export function setRequestState(
  element: Element,
  state: OutcomeState | 'loading',
  status?: number,
): void {
  if (state === 'loading') {
    setLoadingState(element, true);
  } else {
    setOutcomeState(element, state, status);
  }
}
