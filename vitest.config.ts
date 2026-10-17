import './scripts/prepare-satori.js';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const { inputHash } = JSON.parse(readFileSync('artifacts/satori/manifest.json', 'utf8'));

export default defineConfig({
  // Source-only changes must invalidate cached dependency transforms as well.
  cacheDir: `node_modules/.vite/satori-${inputHash}`,
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
});
