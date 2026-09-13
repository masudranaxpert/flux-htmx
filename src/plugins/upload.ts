// Flux Upload Plugin: @flux/plugin-upload
// Handles drag & drop dropzones, file size limits, MIME type validation, and automatic dropped file submission.

import type { FluxPlugin, FluxPluginApi } from '../core/plugin.js';
import { log } from '../core/logger.js';
import { removeGeneratedAttribute, setGeneratedAttribute } from '../core/generated-attributes.js';

const activeUploadControllers = new Map<Element, () => void>();

export function parseMaxSizeBytes(sizeStr?: string | null): number | null {
  if (!sizeStr) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(sizeStr.trim());
  if (!match || !match[1]) return null;
  const num = parseFloat(match[1]);
  const rawUnit = match[2] ?? 'b';
  const unit = rawUnit.toLowerCase();
  const multiplier =
    unit === 'gb' ? 1073741824 : unit === 'mb' ? 1048576 : unit === 'kb' ? 1024 : 1;
  return Math.round(num * multiplier);
}

export const uploadPlugin: FluxPlugin = {
  name: 'upload',
  setup(api: FluxPluginApi) {
    if (typeof document === 'undefined') return;

    const trackedUploadElements = new Set<Element>();
    const disconnectUpload = (element: HTMLElement) => {
      activeUploadControllers.get(element)?.();
      trackedUploadElements.delete(element);
      // Undo everything connect wrote: the plugin may live in a separate bundle from
      // the core, so reconcile's registry-based cleanup cannot see these attributes.
      removeGeneratedAttribute(element, 'hx-post');
      removeGeneratedAttribute(element, 'hx-encoding');
      element.removeAttribute('data-flux-preset');
      element.removeAttribute('data-flux-preset-signature');
    };

    // Register fx-upload preset
    const unregisterPreset = api.registerPreset(
      'fx-upload',
      (element, value) => {
        if (!(element instanceof HTMLFormElement || element instanceof HTMLElement)) return false;
        if (!value || !value.trim()) {
          log.error('[flux] fx-upload requires a non-empty URL');
          return false;
        }

        trackedUploadElements.add(element);

        setGeneratedAttribute(element, 'hx-post', value.trim());
        setGeneratedAttribute(element, 'hx-encoding', 'multipart/form-data');
        element.setAttribute('data-flux-preset', 'upload');

        // Wire file validation & drag-and-drop
        wireUploadElement(element, value.trim());
        return true;
      },
      { disconnect: disconnectUpload },
    );

    return () => {
      unregisterPreset();
      // Clean teardown: dispose all active element upload controllers
      for (const cleanup of Array.from(activeUploadControllers.values())) {
        cleanup();
      }
      activeUploadControllers.clear();

      // Plugin-scoped attribute teardown: clean up only elements managed by upload plugin
      for (const element of Array.from(trackedUploadElements)) {
        removeGeneratedAttribute(element, 'hx-post');
        removeGeneratedAttribute(element, 'hx-encoding');
        element.removeAttribute('data-flux-preset');
        element.removeAttribute('data-flux-preset-signature');
      }
      trackedUploadElements.clear();
    };
  },
};

function wireUploadElement(element: Element, uploadUrl: string): void {
  const maxSizeStr = element.getAttribute('fx-max-size');
  const maxSizeBytes = parseMaxSizeBytes(maxSizeStr);
  const allowedTypes = element
    .getAttribute('fx-allowed-types')
    ?.split(',')
    .map((s) => s.trim().toLowerCase());

  // Signature check including runtime options
  const signature = `${uploadUrl}|${maxSizeStr ?? ''}|${allowedTypes?.join(',') ?? ''}`;
  const currentSig = element.getAttribute('data-flux-preset-signature');
  if (currentSig === signature) return;
  element.setAttribute('data-flux-preset-signature', signature);

  activeUploadControllers.get(element)?.();

  const validateFiles = (files: FileList | File[]): boolean => {
    for (const file of Array.from(files)) {
      if (maxSizeBytes !== null && file.size > maxSizeBytes) {
        log.warn(
          `File "${file.name}" (${file.size} bytes) exceeds fx-max-size limit (${maxSizeBytes} bytes)`,
        );
        element.dispatchEvent(
          new CustomEvent('flux:upload:error', {
            bubbles: true,
            detail: { error: 'max-size-exceeded', file, maxSizeBytes },
          }),
        );
        return false;
      }

      if (allowedTypes && allowedTypes.length > 0) {
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        const matchesType = allowedTypes.some((pattern) => {
          if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -1);
            return fileType.startsWith(prefix);
          }
          if (pattern.startsWith('.')) {
            return fileName.endsWith(pattern);
          }
          return fileType === pattern;
        });

        if (!matchesType) {
          log.warn(`File "${file.name}" type (${file.type}) is not allowed by fx-allowed-types`);
          element.dispatchEvent(
            new CustomEvent('flux:upload:error', {
              bubbles: true,
              detail: { error: 'type-not-allowed', file, allowedTypes },
            }),
          );
          return false;
        }
      }
    }
    return true;
  };

  const onChange = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    if (target instanceof HTMLInputElement && target.type === 'file' && target.files) {
      if (!validateFiles(target.files)) {
        target.value = '';
        evt.preventDefault();
      }
    }
  };

  const onDragOver = (evt: Event) => {
    evt.preventDefault();
    element.setAttribute('data-flux-drag-over', '1');
    element.classList.add('flux-drag-over');
  };

  const onDragLeave = () => {
    element.removeAttribute('data-flux-drag-over');
    element.classList.remove('flux-drag-over');
  };

  const submitFormDataFallback = (
    droppedFiles: FileList | File[],
    fallbackInput?: HTMLInputElement | null,
  ) => {
    const formData = new FormData();
    const fieldName = fallbackInput?.name || 'file';
    for (const file of Array.from(droppedFiles)) {
      formData.append(fieldName, file);
    }
    const activeHtmx = (window as any).htmx ?? (globalThis as any).htmx;
    if (typeof activeHtmx?.ajax === 'function') {
      activeHtmx.ajax('POST', uploadUrl, { source: element, values: formData });
    }
  };

  const onDrop = (evt: DragEvent) => {
    evt.preventDefault();
    onDragLeave();
    const droppedFiles = evt.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    if (validateFiles(droppedFiles)) {
      element.dispatchEvent(
        new CustomEvent('flux:upload:drop', {
          bubbles: true,
          detail: { files: droppedFiles },
        }),
      );

      // Automatic dropped-file binding & upload submission
      const fileInput = element.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (fileInput) {
        try {
          const dataTransfer = new DataTransfer();
          for (const file of Array.from(droppedFiles)) {
            dataTransfer.items.add(file);
          }
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));

          // Auto-submit form on file drop if form element or fileInput form exists
          if (element instanceof HTMLFormElement && typeof element.requestSubmit === 'function') {
            element.requestSubmit();
          } else if (fileInput.form && typeof fileInput.form.requestSubmit === 'function') {
            fileInput.form.requestSubmit();
          }
        } catch (e) {
          log.warn('[flux] DataTransfer file binding unsupported, using FormData fallback:', e);
          submitFormDataFallback(droppedFiles, fileInput);
        }
      } else {
        submitFormDataFallback(droppedFiles);
      }
    }
  };

  element.addEventListener('change', onChange);
  element.addEventListener('dragover', onDragOver);
  element.addEventListener('dragenter', onDragOver);
  element.addEventListener('dragleave', onDragLeave);
  element.addEventListener('drop', onDrop as EventListener);

  const cleanup = () => {
    element.removeEventListener('change', onChange);
    element.removeEventListener('dragover', onDragOver);
    element.removeEventListener('dragenter', onDragOver);
    element.removeEventListener('dragleave', onDragLeave);
    element.removeEventListener('drop', onDrop as EventListener);
    element.removeAttribute('data-flux-drag-over');
    element.classList.remove('flux-drag-over');
    activeUploadControllers.delete(element);
  };

  activeUploadControllers.set(element, cleanup);
}
