import { startRenderWorker } from './core/worker.js';
import { createTemplateRegistry } from './templates/index.js';

await startRenderWorker(createTemplateRegistry());
