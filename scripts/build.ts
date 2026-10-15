import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

// Remove obsolete worker entries and hashed Playground assets before rebuilding.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: { server: 'src/server.ts', worker: 'src/core/worker.ts' },
  outdir: 'dist',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
});
