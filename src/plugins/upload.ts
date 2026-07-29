// Flux Upload Progress Plugin: @flux/plugin-upload
// Handles live upload percentage, drag & drop dropzones, file size limits, MIME type validation, and automatic dropped file submission.

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
  name: 'upload-progress',
  setup(api: FluxPluginApi) {
    if (typeof document === 'undefined') return;

    const trackedUploadElements = new Set<Element>();

    // Register fx-upload preset
    const unregisterPreset = api.registerPreset('fx-upload', (element, value) => {
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
    });

    // Global XHR progress listener
    const onProgress = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail) return;

      const loaded = detail.loaded ?? 0;
      const total = detail.total ?? 0;
      if (total <= 0) return;

      const percent = Math.min(100, Math.round((loaded / total) * 100));

      const source = (evt as CustomEvent).detail?.elt ?? evt.target;
      if (source instanceof Element) {
        const form = source.closest('[fx-upload], [fx-progress]') ?? source;
        const progressSelector = form.getAttribute('fx-progress');
        if (progressSelector) {
          const progressEl = document.querySelector(progressSelector);
          if (progressEl instanceof HTMLProgressElement) {
            progressEl.value = percent;
            progressEl.max = 100;
          } else if (progressEl instanceof HTMLElement) {
            progressEl.style.setProperty('--upload-progress', `${percent}%`);
            progressEl.setAttribute('aria-valuenow', String(percent));
          }
        }
      }
    };

    document.addEventListener('htmx:xhr:progress', onProgress);

    return () => {
      unregisterPreset();
      document.removeEventListener('htmx:xhr:progress', onProgress);
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
  const progressAttr = element.getAttribute('fx-progress') ?? '';
  const allowedTypes = element
    .getAttribute('fx-allowed-types')
    ?.split(',')
    .map((s) => s.trim().toLowerCase());

  // Signature check including runtime options
  const signature = `${uploadUrl}|${progressAttr}|${maxSizeStr ?? ''}|${allowedTypes?.join(',') ?? ''}`;
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
            const group = pattern.slice(0, -2);
            return fileType.startsWith(group);
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
          log.warn('[flux] DataTransfer file binding unsupported:', e);
        }
      } else {
        // Form/Dropzone without file input: submit automatic AJAX upload
        const formData = new FormData();
        for (const file of Array.from(droppedFiles)) {
          formData.append('file', file);
        }
        const activeHtmx = (window as any).htmx ?? (globalThis as any).htmx;
        if (typeof activeHtmx?.ajax === 'function') {
          activeHtmx.ajax('POST', uploadUrl, { source: element, values: formData });
        }
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
