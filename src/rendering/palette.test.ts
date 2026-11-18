import { describe, expect, it } from 'vitest';
import { FOX_PALETTE, normalizeFoxPixels } from './palette';

describe('fox pixel normalization', () => {
  it('removes soft edges, preserves opaque pixels, and selects the shared palette', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 127, 58, 33, 25, 128, 250, 225, 189, 255,
    ]);
    normalizeFoxPixels(data);
    expect([...data.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...data.slice(4, 8)]).toEqual([...FOX_PALETTE[0]!, 255]);
    expect([...data.slice(8, 12)]).toEqual([255, 228, 190, 255]);
  });

  it('leaves an already-normalized frame unchanged', () => {
    const data = new Uint8ClampedArray(FOX_PALETTE.flatMap((c) => [...c, 255]));
    const before = data.slice();
    normalizeFoxPixels(data);
    expect(data).toEqual(before);
  });
});
