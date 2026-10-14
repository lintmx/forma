import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: { server: 'src/server.ts', worker: 'src/core/worker.ts' }, outdir: 'dist',
  bundle: true, packages: 'external', platform: 'node', format: 'esm',
  target: 'node22', sourcemap: true,
});
