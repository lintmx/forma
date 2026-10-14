import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const checksums: Record<string, string> = {
  'NotoSansCJKsc-Regular.otf': '2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b',
  'NotoSansCJKsc-Bold.otf': 'b5f0d1a190a7f9b43c310a8850630af12553df32c4c050543f9059732d9b4c0a',
};
for (const [name, expected] of Object.entries(checksums)) {
  const actual = createHash('sha256')
    .update(await readFile('fonts/' + name))
    .digest('hex');
  if (actual !== expected) throw new Error('Font checksum mismatch: ' + name);
  console.log(name + ': OK');
}
