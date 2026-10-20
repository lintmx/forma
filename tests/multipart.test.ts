import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { readMultipart } from '../src/api/multipart.js';
import { loadConfig } from '../src/config.js';
import { createTemplateRegistry } from '../src/templates/index.js';

const config = loadConfig({});
const form = () => {
  const body = new FormData();
  body.append('request', '{"template":"example","data":{"text":"中文"}}');
  return body;
};
const req = (body: FormData) => new Request('http://test', { method: 'POST', body });
const read = async (body: FormData, overrides = {}) => {
  // Model received HTTP bytes, not Undici's outgoing Blob encoder (which cannot be cancelled safely).
  const encoded = req(body);
  const request = new Request('http://test', {
    method: 'POST',
    headers: encoded.headers,
    body: await encoded.arrayBuffer(),
  });
  return readMultipart(request, { ...config, ...overrides }, AbortSignal.timeout(1000));
};

describe('multipart parsing', () => {
  it('accepts file first, exact limits, arbitrary filenames and binary bytes', async () => {
    const body = new FormData();
    body.append('cover', new Blob([new Uint8Array([0, 255, 13, 10])]), '../../中文.png');
    body.append('request', '{}');
    const parsed = await read(body, { imageMaxBytes: 4, bodyLimit: 2, uploadMaxFiles: 1 });
    expect(parsed.input).toEqual({});
    expect(parsed.attachments.get('cover')).toEqual(Buffer.from([0, 255, 13, 10]));
  });
  it('rejects malformed fields and duplicates', async () => {
    for (const mutate of [
      (b: FormData) => b.delete('request'),
      (b: FormData) => b.append('request', '{}'),
      (b: FormData) => b.set('request', new Blob(['{}']), 'request.json'),
      (b: FormData) => b.append('extra', 'text'),
      (b: FormData) => b.append('../bad', new Blob(['x']), 'x'),
      (b: FormData) => {
        b.append('cover', new Blob(['x']), 'x');
        b.append('cover', new Blob(['y']), 'y');
      },
    ]) {
      const body = form();
      mutate(body);
      await expect(read(body)).rejects.toMatchObject({ code: 'INVALID_MULTIPART', status: 400 });
    }
    const body = form();
    body.set('request', '{');
    await expect(read(body)).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });
  it('enforces JSON, file, count and actual streamed body limits', async () => {
    await expect(read(form(), { bodyLimit: 2 })).rejects.toMatchObject({ status: 413 });
    const body = form();
    body.append('a', new Blob(['12345']), 'a');
    await expect(read(body, { imageMaxBytes: 4 })).rejects.toMatchObject({ status: 413 });
    body.append('b', new Blob(['x']), 'b');
    await expect(read(body, { uploadMaxFiles: 1 })).rejects.toMatchObject({ status: 413 });
    expect(req(body).headers.has('content-length')).toBe(false);
    await expect(read(body, { multipartBodyLimit: 10 })).rejects.toMatchObject({ status: 413 });
  });
  it('bounds concurrent uploads and releases admission after cancellation', async () => {
    const app = createApp(
      { ...config, concurrency: 1, queueLimit: 0 },
      {
        healthy: true,
        stats: { workers: 1, active: 0, queued: 0 },
        render: async () => {
          throw new Error('must not render');
        },
      },
      createTemplateRegistry(),
    );
    const abort = new AbortController();
    let started!: () => void;
    const reading = new Promise<void>(resolve => {
      started = resolve;
    });
    const pending = app.fetch(
      new Request('http://test/v1/render', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        body: new ReadableStream({
          pull() {
            started();
          },
        }),
        signal: abort.signal,
        duplex: 'half',
      } as RequestInit),
    );
    await reading;
    const attempt = () =>
      app.fetch(
        new Request('http://test/v1/render', {
          method: 'POST',
          headers: { 'content-type': 'multipart/form-data; boundary=x' },
          body: '--broken',
        }),
      );
    expect((await attempt()).status).toBe(503);
    abort.abort();
    await pending;
    expect((await attempt()).status).toBe(400);
  });
  it('rejects broken boundaries and cancels stalled reads', async () => {
    for (const type of ['multipart/form-data', 'multipart/form-data; boundary=x']) {
      await expect(
        readMultipart(
          new Request('http://test', { method: 'POST', headers: { 'content-type': type }, body: '--wrong' }),
          config,
          AbortSignal.timeout(1000),
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    let cancelled = false;
    const request = new Request('http://test', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body: new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      duplex: 'half',
    } as RequestInit);
    await expect(readMultipart(request, config, AbortSignal.timeout(20))).rejects.toMatchObject({ status: 504 });
    expect(cancelled).toBe(true);
  });
});
