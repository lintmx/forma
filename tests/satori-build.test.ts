import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it, onTestFinished } from 'vitest';

function fixture(buildTools = true) {
  const root = mkdtempSync(join(tmpdir(), 'forma-satori-build-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const file of [
    'scripts/build-satori-patch.mjs',
    ...(buildTools ? ['patches/satori-text-layout.source.patch', 'pnpm-lock.yaml'] : []),
  ]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(file, join(root, file));
  }
  const installed = realpathSync('node_modules/satori');
  const pkg = join(root, 'node_modules/satori');
  mkdirSync(join(pkg, 'dist'), { recursive: true });
  copyFileSync(join(installed, 'package.json'), join(pkg, 'package.json'));
  // Simulate pnpm hardlinks: preparing the package must not overwrite the store file.
  const store = join(root, 'store.js');
  writeFileSync(store, 'original bundle');
  for (const file of ['index.js', 'index.cjs']) linkSync(store, join(pkg, 'dist', file));
  if (buildTools) {
    copyFileSync(join(installed, 'dist/index.js.map'), join(pkg, 'dist/index.js.map'));
    for (const dependency of ['diff', 'esbuild']) {
      symlinkSync(realpathSync(`node_modules/${dependency}`), join(root, 'node_modules', dependency), 'dir');
    }
  }
  const run = (...args: string[]) =>
    execFileSync(process.execPath, ['scripts/build-satori-patch.mjs', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  return { root, pkg, store, run, output: join(root, 'artifacts/satori') };
}

it('rebuilds reproducibly, preserves store hardlinks, and repairs reinstalled or corrupted bundles', () => {
  const f = fixture();
  f.run();
  const expected = readFileSync('node_modules/satori/dist/index.js');
  const installed = join(f.pkg, 'dist/index.js');
  expect(readFileSync(installed).equals(expected)).toBe(true);
  expect(readFileSync(f.store, 'utf8')).toBe('original bundle');
  const manifest = join(f.output, 'manifest.json');
  const timestamp = statSync(manifest).mtimeMs;
  writeFileSync(installed, 'reinstalled upstream bundle');
  f.run();
  expect(readFileSync(installed).equals(expected)).toBe(true);
  expect(statSync(manifest).mtimeMs).toBe(timestamp);
  writeFileSync(join(f.output, 'index.js'), 'corrupted cache');
  f.run();
  expect(readFileSync(join(f.output, 'index.js')).equals(expected)).toBe(true);
  const patch = join(f.root, 'patches/satori-text-layout.source.patch');
  // A source change must affect the installed bundle even when a cache already exists.
  writeFileSync(patch, readFileSync(patch, 'utf8').replace('cursorY - shapedGlyph.dy', 'cursorY + shapedGlyph.dy'));
  f.run();
  expect(readFileSync(installed).equals(expected)).toBe(false);
});

it('rejects incompatible versions and unappliable source patches before changing installed bundles', () => {
  const f = fixture();
  const manifest = join(f.pkg, 'package.json');
  const original = readFileSync(manifest, 'utf8');
  writeFileSync(manifest, original.replace('"version": "0.62.0"', '"version": "0.62.1"'));
  expect(() => f.run()).toThrow('Source patch requires Satori 0.62.0');
  writeFileSync(manifest, original);
  writeFileSync(
    join(f.root, 'patches/satori-text-layout.source.patch'),
    '--- a/src/font.ts\n+++ b/src/font.ts\n@@ -1 +1 @@\n-does not exist\n+replacement\n',
  );
  expect(() => f.run()).toThrow('Satori source patch failed');
  expect(readFileSync(join(f.pkg, 'dist/index.js'), 'utf8')).toBe('original bundle');
});

it('installs verified production bundles without build tools and rejects corrupted artifacts before writing', () => {
  const f = fixture(false);
  const output = resolve('artifacts/satori');
  f.run('--install-from', output);
  for (const file of ['index.js', 'index.cjs']) {
    expect(readFileSync(join(f.pkg, 'dist', file)).equals(readFileSync(join(output, file)))).toBe(true);
  }
  expect(readFileSync(f.store, 'utf8')).toBe('original bundle');
  cpSync(output, f.output, { recursive: true });
  writeFileSync(join(f.output, 'index.cjs'), 'corrupted output');
  writeFileSync(join(f.pkg, 'dist/index.js'), 'untouched on failure');
  expect(() => f.run('--install-from', f.output)).toThrow('checksum mismatch');
  expect(readFileSync(join(f.pkg, 'dist/index.js'), 'utf8')).toBe('untouched on failure');
});
