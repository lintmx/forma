import { TemplateRegistry } from '../core/registry.js';
import { article } from './article/index.js';
import { bilibili } from './bilibili/index.js';
import { comparison } from './comparison/index.js';
import { example } from './example/index.js';
import { socialPost } from './social_post/index.js';

// Each server, worker or test owns its catalog; registration has no global side effects.
export function createTemplateRegistry() {
  return new TemplateRegistry()
    .register(example)
    .register(socialPost)
    .register(comparison)
    .register(article)
    .register(bilibili);
}
