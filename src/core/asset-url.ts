import { z } from 'zod';

const absoluteUrl = z.url({ protocol: /^(https?|file)$/ }).max(2048);
// A scheme must never be mistaken for a path, including unsupported schemes.
const relativeUrl = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^(?![a-zA-Z][a-zA-Z\d+.-]*:)(?![?#])[^\\\s]+$/, 'Expected a resource URL or path');

export const assetIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const attachmentUrl = z.string().regex(/^asset:[a-zA-Z0-9_-]{1,64}$/);
export const assetUrlSchema = z.union([absoluteUrl, relativeUrl, attachmentUrl]);

export const assetUrlPrefixSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(value => {
    if (!value) return true;
    return (
      /^https?:\/\//i.test(value) && !/[?#]/.test(value) && z.url({ protocol: /^https?$/ }).safeParse(value).success
    );
  }, 'Expected an HTTP(S) directory URL without a query or fragment')
  .overwrite(value => (value ? value.replace(/\/+$/, '') + '/' : value))
  // API output is validated again in the worker, so normalized values must also fit.
  .max(2048);

export function resolveAssetUrl(input: string, prefix?: string): string {
  if (!input || !prefix || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)) return input;
  if (input.startsWith('//')) return new URL(input, prefix).href;
  // Treat a leading slash as part of a resource path, retaining the prefix directory.
  return new URL(input.replace(/^\/+/, ''), prefix.replace(/\/+$/, '') + '/').href;
}
