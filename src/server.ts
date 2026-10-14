import { createServer } from 'node:http';
import { toNodeHandler } from 'h3/node';
import { loadConfig, log } from './config.js';
import { RenderPool } from './core/pool.js';
import { createApp } from './api/app.js';

const config = loadConfig();
const pool = new RenderPool(config);
await pool.start();
const handler = toNodeHandler(createApp(config, pool));
const vite = process.env.FORMA_DEV === 'true'
  ? await (await import('vite')).createServer({ server: { middlewareMode: true }, appType: 'spa' })
  : undefined;
const server = createServer((req, res) => {
  if (vite && (req.url === '/dev' || req.url?.startsWith('/dev/'))) vite.middlewares(req, res, () => handler(req, res));
  else handler(req, res);
});
server.requestTimeout = config.timeoutMs;
server.headersTimeout = Math.min(config.timeoutMs, 10000);
server.listen(config.port, config.host, () => log(config, 'info', 'Forma ready', { port: config.port, playground: config.playground }));
server.on('error', async error => { log(config, 'error', String(error)); await pool.close(); process.exitCode = 1; });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close();
  await pool.close();
  await vite?.close();
  server.closeAllConnections();
}
process.on('SIGTERM', () => { void close(); });
process.on('SIGINT', () => { void close(); });
