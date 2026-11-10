import { PNG } from 'pngjs';
import { loadConfig } from '../../src/config.js';
import { imageAsset } from '../../src/core/images.js';

export const testImage = (data: Buffer = PNG.sync.write(new PNG({ width: 2, height: 2 }))) =>
  imageAsset(data, loadConfig({}));
