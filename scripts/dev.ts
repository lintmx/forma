import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { context } from 'esbuild';

let child: ChildProcess | undefined;
let stopping = false;
async function stopChild() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const previous = child;
    const exited = once(previous, 'exit');
    previous.kill('SIGTERM');
    const timer = setTimeout(() => previous.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timer);
  }
}
const build = await context({
  entryPoints: { server: 'src/server.ts', worker: 'src/core/worker.ts' },
  outdir: '.dev',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  plugins: [
    {
      name: 'restart-server',
      setup(build) {
        build.onEnd(async result => {
          if (result.errors.length || stopping) return;
          await stopChild();
          child = spawn(process.execPath, ['--env-file-if-exists=.env', '--enable-source-maps', '.dev/server.js'], {
            stdio: 'inherit',
            env: { ...process.env, FORMA_DEV: 'true', NODE_ENV: 'development' },
          });
        });
      },
    },
  ],
});
await build.watch();
async function close() {
  stopping = true;
  await build.dispose();
  await stopChild();
}
process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});
