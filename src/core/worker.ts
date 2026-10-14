import { parentPort, workerData } from 'node:worker_threads';
import { loadFonts } from './fonts.js';
import { Renderer } from './renderer.js';
import { publicError } from './errors.js';
import type { Config } from '../config.js';
import type { RenderRequest } from './types.js';

const config = workerData as Config;
const renderer = new Renderer(config, await loadFonts(config.fontConfig));
// Warm Satori's WASM and font parser before accepting HTTP traffic.
await renderer.render({ template: 'notice', data: { title: '就绪 Ready 準備完了' }, format: 'svg' });
parentPort!.on('message', async (request: RenderRequest) => {
  try { parentPort!.postMessage({ result: await renderer.render(request) }); }
  catch (error) { parentPort!.postMessage({ error: publicError(error) }); }
});
parentPort!.postMessage({ ready: true });
