import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Font } from 'satori';
import { z } from 'zod';

export interface LoadedFonts {
  fonts: Font[];
  fontFamily: string;
  monospaceFontFamily: string;
}

const fontSchema = z
  .array(
    z.object({
      name: z.string().min(1),
      path: z.string().min(1),
      weight: z.union([
        z.literal(100),
        z.literal(200),
        z.literal(300),
        z.literal(400),
        z.literal(500),
        z.literal(600),
        z.literal(700),
        z.literal(800),
        z.literal(900),
      ]),
      style: z.enum(['normal', 'italic']).default('normal'),
      usage: z.enum(['body', 'monospace', 'fallback']).default('body'),
    }),
  )
  .min(1)
  .max(12)
  .superRefine((fonts, context) => {
    for (const usage of ['body', 'monospace'] as const) {
      if (!fonts.some(font => font.usage === usage)) {
        context.addIssue({ code: 'custom', message: 'Font config must include a ' + usage + ' font' });
      }
    }
  });

// Each persistent render worker loads its configured fonts exactly once.
export async function loadFonts(configPath: string): Promise<LoadedFonts> {
  const config = fontSchema.parse(JSON.parse(await readFile(configPath, 'utf8')));
  const family = (usage: 'body' | 'monospace') =>
    [...config.filter(font => font.usage === usage), ...config.filter(font => font.usage === 'fallback')]
      .map(font => font.name)
      .filter((name, index, names) => names.indexOf(name) === index)
      .join(', ');
  const fonts = await Promise.all(
    config.map(async ({ path, usage: _usage, ...font }) => ({
      ...font,
      data: await readFile(resolve(dirname(configPath), path)),
    })),
  );
  return { fonts, fontFamily: family('body'), monospaceFontFamily: family('monospace') };
}
