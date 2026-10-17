/** Rebuild Satori from its published sources, or install verified build-stage bundles. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const version = '0.62.0';
const satoriDir = path.dirname(require.resolve('satori/package.json'));
const satoriPackage = JSON.parse(readFileSync(path.join(satoriDir, 'package.json'), 'utf8'));
const localPath = path.relative(path.join(root, 'node_modules'), satoriDir);
if (localPath.startsWith('..') || path.isAbsolute(localPath)) {
  throw new Error('Satori must be installed in project-local node_modules, not a shared virtual store');
}
const files = ['index.js', 'index.cjs'];
const hash = value => createHash('sha256').update(value).digest('hex');
const readJSON = file => JSON.parse(readFileSync(file, 'utf8'));
if (satoriPackage.version !== version) {
  throw new Error(`Source patch requires Satori ${version}`);
}
// Replacing directory entries, rather than writing into existing files, preserves store hardlinks.
function replaceFile(file, contents) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, contents);
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}
function readBundles(directory, manifest) {
  if (manifest.version !== version) throw new Error('Satori bundle version mismatch');
  return files.map(file => {
    const contents = readFileSync(path.join(directory, file));
    if (hash(contents) !== manifest.bundles[file]) throw new Error(`Satori bundle checksum mismatch: ${file}`);
    return [file, contents];
  });
}
function install(bundles) {
  for (const [file, contents] of bundles) {
    const target = path.join(satoriDir, 'dist', file);
    let current;
    try {
      current = readFileSync(target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!current?.equals(contents)) replaceFile(target, contents);
  }
}
const args = process.argv.slice(2);
if (args.length && (args[0] !== '--install-from' || args.length !== 2)) {
  throw new Error('Usage: node scripts/build-satori-patch.mjs [--install-from directory]');
}
const directory = path.resolve(args[1] ?? path.join(root, 'artifacts/satori'));
const manifestFile = path.join(directory, 'manifest.json');
// Both paths finish building or validating ALL bundles before replacing installed files.
install(args.length ? readBundles(directory, readJSON(manifestFile)) : await prepare());
async function prepare() {
  const { build, version: esbuildVersion } = await import('esbuild');
  const { applyPatch, parsePatch } = await import('diff');
  const mapText = readFileSync(path.join(satoriDir, 'dist/index.js.map'), 'utf8');
  const patchText = readFileSync(path.join(root, 'patches/satori-text-layout.source.patch'), 'utf8');
  const inputHash = hash(
    JSON.stringify([
      version,
      esbuildVersion,
      mapText,
      patchText,
      readFileSync(fileURLToPath(import.meta.url), 'utf8'),
      readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
    ]),
  );
  let cached;
  try {
    const manifest = readJSON(manifestFile);
    if (manifest.inputHash === inputHash) cached = readBundles(directory, manifest);
  } catch (error) {
    if (error.code && error.code !== 'ENOENT') throw error;
    // Missing or invalid generated output is rebuilt from the original sources.
  }
  if (cached) return cached;
  const map = JSON.parse(mapText);
  const sources = new Map(map.sources.map((s, i) => [path.posix.resolve('/satori/dist', s), map.sourcesContent[i]]));
  const patches = parsePatch(patchText);
  if (!patches.length) throw new Error('Satori source patch is empty');
  for (const patch of patches) {
    const sourcePath = '/satori/' + patch.oldFileName.replace(/^a\//, '');
    if (!sources.has(sourcePath)) throw new Error(`Missing patch source: ${sourcePath}`);
    const patched = applyPatch(sources.get(sourcePath), patch, { fuzzFactor: 0 });
    if (patched === false) throw new Error(`Satori source patch failed: ${sourcePath}`);
    sources.set(sourcePath, patched);
  }
  sources.set(
    '/satori/entry.ts',
    "export { default } from './src/satori.ts'; export { init } from './src/layout-engine/wasm.ts';",
  );
  // These aliases reproduce upstream's bundled dependencies and browser-safe shims.
  const aliases = {
    'twrnc/create': 'twrnc/dist/esm/create.js',
    'util-deprecate': '/satori/src/vendor/twrnc/deprecate.js',
    picocolors: '/satori/src/vendor/twrnc/picocolors.js',
    'parse-css-dimension': '/satori/src/vendor/parse-css-dimension/index.js',
  };
  const external = new Set(Object.keys(satoriPackage.dependencies));
  const original = p => ({ path: p, namespace: 'original' });
  const plugin = {
    name: 'published-sources',
    setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        let name = args.path;
        if (name === '/satori/entry.ts') return original(name);
        if (args.namespace !== 'original') return;
        if (name.startsWith('.')) {
          const base = path.posix.resolve(path.posix.dirname(args.importer), name);
          const vendor = base.match(/tailwindcss\/lib\/util\/(log|deprecate)$/)?.[1];
          if (vendor) return original(`/satori/src/vendor/twrnc/${vendor}.js`);
          for (const p of [
            base,
            base.replace(/\.js$/, '.ts'),
            `${base}/index.js`,
            `${base}/index.ts`,
            `${base}.js`,
            `${base}.ts`,
          ]) {
            if (sources.has(p)) return original(p);
          }
          throw new Error(`Missing published source: ${base}`);
        }
        name = aliases[name] ?? name;
        if (sources.has(name)) return original(name);
        const endings = ['', '.js', '/index.js', '/index.mjs', '/dist/index.js', '/lib/index.js', `/${name}.js`].map(
          suffix => `/node_modules/${name}${suffix}`,
        );
        const found = [...sources.keys()].find(p => endings.some(ending => p.endsWith(ending)));
        if (found) return original(found);
        if (!external.has(name)) throw new Error(`Unresolved dependency: ${name}`);
        return { path: name, external: true };
      });
      b.onLoad({ filter: /.*/, namespace: 'original' }, args => ({
        contents: sources.get(args.path),
        loader: args.path.endsWith('.ts') ? 'ts' : 'js',
        resolveDir: satoriDir,
      }));
    },
  };
  const bundles = [];
  for (const format of ['esm', 'cjs']) {
    const file = `index.${format === 'esm' ? 'js' : 'cjs'}`;
    const result = await build({
      entryPoints: ['/satori/entry.ts'],
      bundle: true,
      minify: true,
      format,
      target: 'es2022',
      platform: 'neutral',
      outfile: file,
      write: false,
      plugins: [plugin],
      define: { 'process.env.SATORI_STANDALONE': '"0"', 'process.env.NODE_ENV': '"production"' },
    });
    bundles.push([file, Buffer.from(result.outputFiles[0].contents)]);
  }
  mkdirSync(directory, { recursive: true });
  for (const [file, contents] of bundles) replaceFile(path.join(directory, file), contents);
  const manifest = {
    version,
    inputHash,
    bundles: Object.fromEntries(bundles.map(([file, data]) => [file, hash(data)])),
  };
  replaceFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Satori ${version}: rebuilt from source patch`);
  return bundles;
}
