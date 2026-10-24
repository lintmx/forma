import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TemplateRegistry } from '../src/core/registry.js';
import type { Template } from '../src/core/types.js';
import { createTemplateRegistry } from '../src/templates/index.js';

const template: Template<{ title: string }> = {
  id: 'content-only',
  name: '内容模板',
  description: '只定义业务内容',
  schema: z.object({ title: z.string().min(1) }).strict(),
  sizing: { mode: 'auto-height', width: 420 },
  mock: { title: '示例' },
  render: data => createElement('div', { style: { display: 'flex' } }, data.title),
};

describe('content-only template registry', () => {
  it('isolates registrations between production catalogs and supports an empty catalog', () => {
    const first = createTemplateRegistry().register(template);
    const second = createTemplateRegistry();
    expect(first.get(template.id).id).toBe(template.id);
    expect(() => second.get(template.id)).toThrow(expect.objectContaining({ code: 'TEMPLATE_NOT_FOUND' }));
    expect(new TemplateRegistry().list()).toEqual([]);
  });
  it('allows underscore template IDs and still rejects invalid or duplicate IDs', () => {
    const registry = new TemplateRegistry().register({ ...template, id: 'social_post' });
    expect(registry.get('social_post').id).toBe('social_post');
    expect(() => registry.register({ ...template, id: 'social_post' })).toThrow('Invalid or duplicate template');
    for (const id of ['Social_post', '_social_post', 'social/post', 'social post']) {
      expect(() => new TemplateRegistry().register({ ...template, id })).toThrow('Invalid or duplicate template');
    }
  });
  it('keeps schema and examples content-only', () => {
    const registry = new TemplateRegistry().register(template);
    const metadata = registry.metadata(template.id);
    expect(metadata.schema.properties).not.toHaveProperty('watermark');
    expect(metadata.schema.additionalProperties).toBe(false);
    expect(metadata.mock).toEqual({ title: '示例' });
    expect(metadata.presets).toEqual([{ id: 'default', name: '默认示例', data: metadata.mock }]);
    expect(metadata).not.toHaveProperty('documentation');
    expect(template.mock).toEqual({ title: '示例' });
    expect(registry.validate(template.id, { title: '示例' })).toEqual({
      title: '示例',
    });
  });
  it('exposes complete presets with top-level options without changing the original definition', () => {
    const preset = {
      id: 'compact',
      name: '精简内容',
      data: { title: '短标题' },
      watermark: '',
      assetUrlPrefix: 'https://example.com/images',
    };
    const registry = new TemplateRegistry().register({ ...template, presets: [preset] });
    expect(registry.metadata(template.id).presets).toEqual([
      { id: 'default', name: '默认示例', data: template.mock },
      { ...preset, assetUrlPrefix: 'https://example.com/images/' },
    ]);
    expect(preset.assetUrlPrefix).toBe('https://example.com/images');
    expect(registry.list()[0]).toEqual(registry.metadata(template.id));
  });
  it('rejects invalid preset identities, data and options during registration', () => {
    const preset = { id: 'short', name: '短文本', data: { title: '短标题' } };
    for (const invalid of [
      { id: 'default' },
      { id: 'Bad ID' },
      { name: ' ' },
      { data: { title: '' } },
      { data: { title: '标题', watermark: 'wrong level' } },
      { watermark: 'x'.repeat(161) },
      { assetUrlPrefix: 'file:///tmp/' },
      { format: 'png' },
    ]) {
      expect(() => new TemplateRegistry().register({ ...template, presets: [{ ...preset, ...invalid }] })).toThrow();
    }
    expect(() => new TemplateRegistry().register({ ...template, presets: [preset, preset] })).toThrow(
      'Duplicate preset',
    );
  });
  it('validates presets with refinements but preserves their input for rendering', () => {
    const schema = z
      .object({ title: z.string().overwrite(value => value + '!') })
      .refine(data => data.title !== 'invalid!');
    const preset = { id: 'short', name: '短文本', data: { title: '短标题' } };
    const registry = new TemplateRegistry().register({ ...template, schema, presets: [preset] });
    const input = registry.metadata(template.id).presets[1]!.data;
    expect(input).toEqual({ title: '短标题' });
    expect(registry.validate(template.id, input)).toEqual({ title: '短标题!' });
    expect(() =>
      new TemplateRegistry().register({ ...template, schema, presets: [{ ...preset, data: { title: 'invalid' } }] }),
    ).toThrow();
  });
  it('provides valid, named presets for every production template', () => {
    const registry = createTemplateRegistry();
    for (const metadata of registry.list()) {
      expect(metadata.presets.length).toBeGreaterThan(1);
      expect(new Set(metadata.presets.map(preset => preset.id)).size).toBe(metadata.presets.length);
      for (const preset of metadata.presets) expect(() => registry.validate(metadata.id, preset.data)).not.toThrow();
    }
  });
  it('keeps business refinements and rejects render options inside content and unknown fields', () => {
    const schema = z.object({ title: z.string().min(1) }).refine(data => data.title !== 'invalid', {
      path: ['title'],
      message: 'Invalid title',
    });
    const registry = new TemplateRegistry().register({ ...template, schema });
    for (const data of [
      { title: 'invalid' },
      { title: '示例', watermark: 'Generated by Forma' },
      { title: '示例', surprise: true },
    ]) {
      expect(() => registry.validate(template.id, data)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    }
  });
  it('prevents templates from redefining render options or including them in their mock data', () => {
    expect(() =>
      new TemplateRegistry().register({
        ...template,
        schema: z.object({
          title: z.string(),
          watermark: z.string().optional(),
        }),
      }),
    ).toThrow('Template field is reserved for a top-level render option: watermark');
    const legacyMock = { title: '示例', watermark: '' };
    expect(() => new TemplateRegistry().register({ ...template, mock: legacyMock })).toThrow();
  });
});
