import { expect } from 'vitest';

// Bound visible color error at full resolution, including partially transparent pixels.
export function expectPngQuality(actual: ArrayLike<number>, reference: ArrayLike<number>) {
  expect(actual.length).toBe(reference.length);
  let absoluteError = 0;
  let squaredError = 0;
  let alphaError = 0;
  for (let index = 0; index < reference.length; index += 4) {
    const actualAlpha = actual[index + 3]! / 255;
    const referenceAlpha = reference[index + 3]! / 255;
    for (let channel = 0; channel < 3; channel++) {
      // Fully transparent palette entries may carry arbitrary, invisible RGB values.
      const actualColor = actual[index + channel]! * actualAlpha + 255 * (1 - actualAlpha);
      const referenceColor = reference[index + channel]! * referenceAlpha + 255 * (1 - referenceAlpha);
      const difference = actualColor - referenceColor;
      absoluteError += Math.abs(difference);
      squaredError += difference * difference;
    }
    alphaError = Math.max(alphaError, Math.abs(actual[index + 3]! - reference[index + 3]!));
  }
  const samples = reference.length / 4 * 3;
  const psnr = squaredError === 0 ? Infinity : 10 * Math.log10(255 ** 2 / (squaredError / samples));
  expect(absoluteError / samples).toBeLessThan(3);
  expect(psnr).toBeGreaterThan(38);
  expect(alphaError).toBeLessThanOrEqual(1);
}
