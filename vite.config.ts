import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isFull = mode.startsWith('full');
  const isIife = mode.endsWith('iife');

  const entry = isFull
    ? isIife
      ? 'src/full.iife.ts'
      : 'src/full.ts'
    : isIife
      ? 'src/iife.ts'
      : 'src/flux.ts';

  const fileName = isFull
    ? isIife
      ? 'flux.full.iife.js'
      : 'flux.full.js'
    : isIife
      ? 'flux.iife.js'
      : 'flux.js';

  return {
    build: {
      sourcemap: true,
      minify: 'oxc',
      emptyOutDir: mode === 'es',
      lib: {
        entry,
        name: 'Flux',
        formats: [isIife ? 'iife' : 'es'],
        fileName: () => fileName,
      },
      rollupOptions: {
        external: isFull ? [] : ['htmx.org'],
        output: {
          exports: isIife ? 'default' : 'named',
          globals: {
            'htmx.org': '(globalThis.htmx || void 0)',
          },
        },
      },
    },
  };
});
