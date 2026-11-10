import { writeFileSync } from 'node:fs';
import { Renderer } from '@takumi-rs/core';

process.once('message', () => {
  process.send({ ready: true });
  process.on('message', async ({ request, attachments }) => {
    if (request.data === 'crash') process.exit(1);
    if (request.data === 'hang') {
      while (true) {}
    }
    if (typeof request.data === 'object' && request.data.native) {
      const renderer = new Renderer();
      const node = {
        type: 'container',
        style: { display: 'flex', flexDirection: 'column' },
        children: Array.from({ length: 30000 }, () => ({
          type: 'text',
          text: 'native rendering '.repeat(100),
          style: { fontSize: 20 },
        })),
      };
      writeFileSync(request.data.started, String(process.pid));
      await renderer.render(node, { width: 1600, height: 1600 });
    }
    process.send({
      result: {
        body: attachments?.get('cover') ?? new Uint8Array([1]),
        width: 1,
        height: 1,
        layoutWidth: process.pid,
        layoutHeight: 1,
        scale: 2,
        format: 'png',
        warnings: [],
      },
    });
  });
});
process.on('disconnect', () => process.exit(0));
