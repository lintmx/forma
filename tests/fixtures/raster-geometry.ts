import { expect } from 'vitest';

// Cross-engine check for the synthetic SVG geometry fixtures. Large changes
// must be confined to a one-pixel neighborhood of an existing reference edge;
// solid interiors and total changed area stay bounded independently of PSNR.
export function expectRasterGeometry(actual: Uint8Array, reference: Uint8Array, width: number) {
  expect(actual.length).toBe(reference.length);
  const height = reference.length / 4 / width;
  let changed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      let delta = 0;
      for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(actual[offset + c]! - reference[offset + c]!));
      if (delta <= 8) continue;
      changed++;
      let edge = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
          const neighbor = ((y + dy) * width + x + dx) * 4;
          for (let c = 0; c < 4; c++) if (Math.abs(reference[offset + c]! - reference[neighbor + c]!) > 16) edge = true;
        }
      expect(edge, `unexpected interior difference at ${x},${y}: ${delta}`).toBe(true);
    }
  }
  expect(changed / (width * height)).toBeLessThan(0.01);
}
