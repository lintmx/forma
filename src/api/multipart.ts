import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import type { Config } from '../config.js';
import { assetIdPattern } from '../core/asset-url.js';
import { FormaError } from '../core/errors.js';
import type { Attachments } from '../core/request.js';

export async function readMultipart(request: Request, config: Config, signal: AbortSignal) {
  const invalid = () => new FormaError('INVALID_MULTIPART', 'Invalid multipart render request', 400);
  const limit = () => new FormaError('BODY_LIMIT', 'Upload exceeds configured limits', 413);
  if (Number(request.headers.get('content-length') ?? 0) > config.multipartBodyLimit) throw limit();
  if (!request.body) throw invalid();
  let parser: ReturnType<typeof busboy>;
  try {
    parser = busboy({
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
      limits: {
        fieldSize: config.bodyLimit + 1,
        fields: 1,
        files: config.uploadMaxFiles,
        fileSize: config.imageMaxBytes + 1,
        parts: config.uploadMaxFiles + 2,
      },
    });
  } catch {
    throw invalid();
  }
  let json: string | undefined;
  let failure: FormaError | undefined;
  const attachments: Attachments = new Map();
  const names = new Set<string>();
  // Defer destruction until Busboy finishes its current parser callback.
  const fail = (error: FormaError) => {
    failure ??= error;
    queueMicrotask(() => parser.destroy(error));
  };
  parser.on('field', (name, value, info) => {
    if (info.valueTruncated || Buffer.byteLength(value) > config.bodyLimit) return fail(limit());
    if (name !== 'request' || json !== undefined || info.nameTruncated) return fail(invalid());
    json = value;
  });
  parser.on('file', (name, stream) => {
    stream.on('error', () => {});
    if (name === 'request' || !assetIdPattern.test(name) || names.has(name)) {
      stream.resume();
      return fail(invalid());
    }
    names.add(name);
    const chunks: Buffer[] = [];
    let bytes = 0;
    stream.on('limit', () => fail(limit()));
    stream.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > config.imageMaxBytes) return fail(limit());
      if (!failure) chunks.push(chunk);
    });
    stream.on('end', () => {
      if (!failure) attachments.set(name, Buffer.concat(chunks));
    });
  });
  parser.on('fieldsLimit', () => fail(invalid()));
  parser.on('filesLimit', () => fail(limit()));
  parser.on('partsLimit', () => fail(limit()));
  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      callback(size > config.multipartBodyLimit ? limit() : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]), counter, parser, {
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw new FormaError('RENDER_TIMEOUT', 'Request deadline exceeded', 504);
    throw failure ?? (error instanceof FormaError ? error : invalid());
  }
  if (failure) throw failure;
  if (json === undefined) throw invalid();
  try {
    return { input: JSON.parse(json) as unknown, attachments };
  } catch {
    throw new FormaError('INVALID_JSON', 'Malformed JSON', 400);
  }
}
