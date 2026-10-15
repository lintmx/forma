import { parentPort, workerData } from 'node:worker_threads';
import { createElement } from 'react';
import satori from 'satori';
import type { Config } from '../config.js';
import { publicError } from './errors.js';
import { loadFonts } from './fonts.js';
import type { TemplateRegistry } from './registry.js';
import { Renderer } from './renderer.js';
import type { RenderRequest } from './request.js';

export async function startRenderWorker(registry: TemplateRegistry) {
  const config = workerData as Config;
  const fonts = await loadFonts(config.fontConfig);
  // Warm Satori's WASM and font parser before accepting HTTP traffic.
  await satori(createElement('div', { style: { display: 'flex', fontFamily: fonts.fontFamily } }, 'Ready'), {
    fonts: fonts.fonts,
    width: 100,
  });
  const renderer = new Renderer(config, fonts, registry);
  parentPort!.on('message', async (request: RenderRequest) => {
    try {
      parentPort!.postMessage({ result: await renderer.render(request) });
    } catch (error) {
      parentPort!.postMessage({ error: publicError(error) });
    }
  });
  parentPort!.postMessage({ ready: true });
}
