import { TemplateRegistry } from '../core/registry.js';
import { comparison } from './comparison/index.js';
import { example } from './example/index.js';
import { socialPost } from './social_post/index.js';

// Import and register production templates here as they are developed.
export const registry = new TemplateRegistry().register(example).register(socialPost).register(comparison);
