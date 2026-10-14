import { registerTestTemplates } from './templates.js';

registerTestTemplates();
await import('../../src/core/worker.js');
