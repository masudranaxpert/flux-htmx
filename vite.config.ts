import { defineConfig } from 'vite';

// Build matrix (one mode per artifact):
//   es         → dist/flux.js        modular ESM, htmx.org external (peer)
//   cjs        → dist/flux.cjs       CJS for require(), htmx.org external
//   iife       → dist/flux.iife.js   browser global, htmx from globalThis
//   net-es     → dist/net.js         optional offline/upload/optimistic entry (ESM)
//   net-cjs    → dist/net.cjs        optional entry (CJS)
//   net-iife   → dist/net.iife.js    optional entry, browser global (FluxNet)
//   full-es    → dist/flux.full.js   htmx + everything bundled
//   full-iife  → dist/flux.full.iife.js  single <script> CDN bundle

interface ModePlan {
  entry: string;
  fileName: string;
  formats: Array<'es' | 'cjs' | 'iife'>;
  external: string[];
  name?: string;
  emptyOutDir?: boolean;
}

const PLANS: Record<string, ModePlan> = {
  es: {
    entry: 'src/flux.ts',
    fileName: 'flux.js',
    formats: ['es'],
    external: ['htmx.org'],
    emptyOutDir: true,
  },
  cjs: { entry: 'src/flux.ts', fileName: 'flux.cjs', formats: ['cjs'], external: ['htmx.org'] },
  iife: {
    entry: 'src/iife.ts',
    fileName: 'flux.iife.js',
    formats: ['iife'],
    external: ['htmx.org'],
    name: 'Flux',
  },
  'net-es': { entry: 'src/net.ts', fileName: 'net.js', formats: ['es'], external: [] },
  'net-cjs': { entry: 'src/net.ts', fileName: 'net.cjs', formats: ['cjs'], external: [] },
  'net-iife': {
    entry: 'src/net.iife.ts',
    fileName: 'net.iife.js',
    formats: ['iife'],
    external: [],
    name: 'FluxNet',
  },
  'full-es': { entry: 'src/full.ts', fileName: 'flux.full.js', formats: ['es'], external: [] },
  'full-iife': {
    entry: 'src/full.iife.ts',
    fileName: 'flux.full.iife.js',
    formats: ['iife'],
    external: [],
    name: 'Flux',
  },
};

export default defineConfig(({ mode }) => {
  const plan = PLANS[mode];
  if (!plan)
    throw new Error(
      `[vite] unknown build mode "${mode}" (expected one of: ${Object.keys(PLANS).join(', ')})`,
    );

  return {
    build: {
      sourcemap: true,
      minify: 'oxc',
      emptyOutDir: plan.emptyOutDir ?? false,
      lib: {
        entry: plan.entry,
        name: plan.name ?? 'Flux',
        formats: plan.formats,
        fileName: () => plan.fileName,
      },
      rollupOptions: {
        external: plan.external,
        output: {
          exports: plan.formats.includes('iife') ? 'default' : 'named',
          globals: {
            'htmx.org': '(globalThis.htmx || void 0)',
          },
        },
      },
    },
  };
});
