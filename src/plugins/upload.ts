// Flux Upload Progress Plugin: @flux/plugin-upload
// Handles live upload percentage, drag & drop dropzones, file size limits, and MIME type validation.

import type { FluxPlugin, FluxPluginApi } from '../core/plugin.js';
import { log } from '../core/logger.js';

export function parseMaxSizeBytes(sizeStr?: string | null): number | null {
  if (!sizeStr) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(sizeStr.trim());
  if (!match || !match[1]) return null;
  const num = parseFloat(match[1]);
  const rawUnit = match[2] ?? 'b';
  const unit = rawUnit.toLowerCase();
  const multiplier = unit === 'gb' ? 1073741824 : unit === 'mb' ? 1048576 : unit === 'kb' ? 1024 : 1;
  return Math.round(num * multiplier);
}

export const uploadPlugin: FluxPlugin = {
  name: 'upload-progress',
  setup(api: FluxPluginApi) {
    if (typeof document === 'undefined') return;

    // Register fx-upload preset
    const unregisterPreset = api.registerPreset('fx-upload', (element, value) => {
      if (!(element instanceof HTMLFormElement || element instanceof HTMLElement)) return false;

      element.setAttribute('hx-post', value);
      element.setAttribute('hx-encoding', 'multipart/form-data');
      element.setAttribute('data-flux-preset', 'upload');

      // Wire file validation & drag-and-drop
      wireUploadElement(element);
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
    };
  },
};

function wireUploadElement(element: Element): void {
  const maxSizeStr = element.getAttribute('fx-max-size');
  const maxSizeBytes = parseMaxSizeBytes(maxSizeStr);
  const allowedTypes = element.getAttribute('fx-allowed-types')?.split(',').map((s) => s.trim().toLowerCase());

  const validateFiles = (files: FileList | File[]): boolean => {
    for (const file of Array.from(files)) {
      if (maxSizeBytes !== null && file.size > maxSizeBytes) {
        log.warn(`File "${file.name}" (${file.size} bytes) exceeds fx-max-size limit (${maxSizeBytes} bytes)`);
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

  element.addEventListener('change', onChange);
}
