import type { BuildOptions } from 'esbuild';

export const buildOptions: BuildOptions = {
  entryPoints: { server: 'src/server.ts', worker: 'src/worker.ts' },
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
};
