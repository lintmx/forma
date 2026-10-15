import { startRenderWorker } from '../../src/core/worker.js';
import { createTemplateRegistry } from '../../src/templates/index.js';
import { registerTestTemplates } from './templates.js';

const registry = createTemplateRegistry();
registerTestTemplates(registry);
await startRenderWorker(registry);
