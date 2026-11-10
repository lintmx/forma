import type { Config } from '../config.js';
import { publicError } from './errors.js';
import { loadFonts } from './fonts.js';
import type { TemplateRegistry } from './registry.js';
import { Renderer } from './renderer.js';
import type { RenderJob } from './request.js';

export async function startRenderWorker(registry: TemplateRegistry) {
  process.once('message', async (message: { config: Config }) => {
    try {
      const config = message.config;
      const renderer = new Renderer(config, await loadFonts(config.fontConfig), registry);
      await renderer.warmup();
      process.on('message', async ({ request, attachments }: RenderJob) => {
        try {
          process.send!({ result: await renderer.render(request, attachments) });
        } catch (error) {
          process.send!({ error: publicError(error) });
        }
      });
      process.send!({ ready: true });
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
  process.on('disconnect', () => process.exit(0));
}
