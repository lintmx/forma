import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Font } from 'satori';
import { z } from 'zod';

const fontSchema = z.array(z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  weight: z.union([z.literal(100), z.literal(200), z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800), z.literal(900)]),
  style: z.enum(['normal', 'italic']).default('normal'),
})).min(1).max(12);

// Each persistent render worker loads its configured fonts exactly once.
export async function loadFonts(configPath: string): Promise<Font[]> {
  const config = fontSchema.parse(JSON.parse(await readFile(configPath, 'utf8')));
  return Promise.all(config.map(async ({ path, ...font }) => ({
    ...font, data: await readFile(resolve(dirname(configPath), path)),
  })));
}
