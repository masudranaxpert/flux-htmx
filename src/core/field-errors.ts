// Server-driven field validation errors (fx-field-errors).
//
// Protocol: server responds 422 with a JSON object of field -> message:
//   {"email": "already taken", "port": "must be 1-65535"}
// Flux fills [data-field-error="<name>"] elements, marks invalid inputs with
// aria-invalid="true" + data-invalid, focuses the first invalid field, and clears
// everything as soon as the user edits a field again.

const FIELD_ERRORS_ATTR = 'fx-field-errors';

function clearFieldErrors(form: Element): void {
  for (const slot of form.querySelectorAll('[data-field-error]')) {
    slot.textContent = '';
  }
  for (const input of form.querySelectorAll('[aria-invalid="true"], [data-invalid]')) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('data-invalid');
  }
}

function onAfterRequest(evt: Event): void {
  const detail = (evt as CustomEvent).detail as {
    ctx?: { source?: Element; successful?: boolean };
    xhr?: { status?: number; responseText?: string };
    successful?: boolean;
  } | null;
  const source = detail?.ctx?.source;
  const form = source?.closest?.(`[${FIELD_ERRORS_ATTR}]`) as HTMLFormElement | null;
  if (!form || detail?.ctx?.successful !== false) return;

  const status = detail?.xhr?.status ?? 0;
  if (status !== 422 && status !== 400) return;

  let errors: Record<string, string>;
  try {
    errors = JSON.parse(detail?.xhr?.responseText ?? '{}') as Record<string, string>;
  } catch {
    return; // not the field-errors protocol — leave other handlers to it
  }

  clearFieldErrors(form);
  let firstInvalid: HTMLElement | null = null;
  for (const [name, message] of Object.entries(errors)) {
    const slot = form.querySelector<HTMLElement>(`[data-field-error="${name}"]`);
    if (slot) slot.textContent = message;
    const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('data-invalid', 'true');
      firstInvalid = firstInvalid ?? input;
    }
  }
  firstInvalid?.focus();

  // clear as soon as the user edits any field in this form
  const onChange = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target && form.contains(target)) {
      clearFieldErrors(form);
      form.removeEventListener('input', onChange);
    }
  };
  form.addEventListener('input', onChange);
}

export function installFieldErrors(): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('htmx:after:request', onAfterRequest);
  return () => document.removeEventListener('htmx:after:request', onAfterRequest);
}
