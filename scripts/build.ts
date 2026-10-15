import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { buildOptions } from './build-options.js';

// Remove obsolete worker entries and hashed Playground assets before rebuilding.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  ...buildOptions,
  outdir: 'dist',
});
