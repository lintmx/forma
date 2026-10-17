import { execFileSync } from 'node:child_process';

// Run before importing Satori, including direct Vitest and rendering-script invocations.
execFileSync(process.execPath, ['scripts/build-satori-patch.mjs'], { stdio: 'inherit' });
