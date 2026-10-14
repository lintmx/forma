import { z } from 'zod';
import type { Template } from './types.js';
import { FormaError } from './errors.js';
import { cardOptionsSchema } from './card.js';

export class TemplateRegistry {
  private templates = new Map<string, Template>();
  register<T extends Record<string, unknown>>(template: Template<T>) {
    if (!/^[a-z][a-z0-9_-]*$/.test(template.id) || this.templates.has(template.id)) throw new Error('Invalid or duplicate template: ' + template.id);
    if (!(template.schema instanceof z.ZodObject)) throw new Error('Template schema must be a Zod object: ' + template.id);
    for (const key of Object.keys(cardOptionsSchema.shape)) {
      if (Object.hasOwn(template.schema.shape, key)) throw new Error('Template field is reserved for a top-level render option: ' + key);
    }
    const schema = template.schema.strict();
    const mock = schema.parse(template.mock);
    if (template.sizing.mode === 'content' && !template.measure) throw new Error('Content templates require an intrinsic measure tree');
    this.templates.set(template.id, {
      ...template, schema, mock,
    } as Template);
    return this;
  }
  get(id: string) {
    const template = this.templates.get(id);
    if (!template) throw new FormaError('TEMPLATE_NOT_FOUND', 'Unknown template: ' + id, 404);
    return template;
  }
  list() { return [...this.templates.values()].map(template => this.metadata(template.id)); }
  metadata(id: string) {
    const t = this.get(id);
    return { id: t.id, name: t.name, description: t.description, sizing: t.sizing, schema: z.toJSONSchema(t.schema), mock: t.mock };
  }
  validate(id: string, data: unknown) {
    const parsed = this.get(id).schema.safeParse(data);
    if (!parsed.success) throw new FormaError('VALIDATION_ERROR', 'Template data is invalid', 400, parsed.error.issues);
    return parsed.data;
  }
}
