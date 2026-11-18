/** Shared fox/blanket palette. Runtime pixels have binary alpha and no gradients. */
export const FOX_PALETTE: readonly (readonly [number, number, number])[] = [
  [55, 32, 24],
  [78, 47, 36],
  [105, 65, 49],
  [139, 75, 48],
  [167, 83, 48],
  [195, 100, 55],
  [215, 118, 65],
  [230, 143, 86],
  [239, 169, 119],
  [255, 171, 128],
  [201, 156, 112],
  [233, 202, 159],
  [255, 228, 190],
  [79, 94, 115],
  [112, 129, 151],
  [169, 186, 201],
];

export function normalizeFoxPixels(data: Uint8ClampedArray): void {
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3]! < 128) {
      data.fill(0, offset, offset + 4);
      continue;
    }
    let nearest = FOX_PALETTE[0]!;
    let distance = Infinity;
    for (const color of FOX_PALETTE) {
      const candidate = color.reduce(
        (sum, channel, index) => sum + (channel - data[offset + index]!) ** 2,
        0,
      );
      if (candidate < distance) {
        distance = candidate;
        nearest = color;
      }
    }
    data.set([...nearest, 255], offset);
  }
}
