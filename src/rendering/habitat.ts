import testSpiritUrl from '../../assets/pets/test-spirit/reference.png';
import type { Mood } from '../engine/spirit';

/** Crop transparent padding at render time; the concept source stays untouched. */
function opaqueBounds(
  image: HTMLImageElement,
): [number, number, number, number] {
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (data[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('The test sprite is empty.');
  return [left, top, right - left + 1, bottom - top + 1];
}

export async function createHabitatRenderer(
  canvas: HTMLCanvasElement,
): Promise<{ draw: (mood: Mood) => number[] }> {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  const image = new Image();
  image.src = testSpiritUrl;
  await image.decode();
  const bounds = opaqueBounds(image);
  const ratio = 48 / Math.max(bounds[2], bounds[3]);
  const width = Math.round(bounds[2] * ratio);
  const height = Math.round(bounds[3] * ratio);
  // Cache the test sprite at its source grid once; redraw only when mood changes.
  const sprite = document.createElement('canvas');
  sprite.width = width;
  sprite.height = height;
  const pixels = sprite.getContext('2d');
  if (!pixels) throw new Error('Canvas is unavailable.');
  pixels.imageSmoothingEnabled = false;
  pixels.drawImage(image, ...bounds, 0, 0, width, height);

  return {
    draw(mood) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      if (mood === 'Sleeping') {
        context.save();
        context.translate(55, 70);
        context.rotate(Math.PI / 2);
        context.drawImage(
          sprite,
          -Math.floor(width / 2),
          -Math.floor(height / 2),
        );
        context.restore();
        context.fillStyle = '#707e91';
        context.fillRect(32, 80, 46, 14);
        context.fillStyle = '#adb7bf';
        context.fillRect(32, 80, 46, 2);
      } else {
        context.drawImage(sprite, Math.floor((110 - width) / 2), 96 - height);
      }
      // Provisional pixel cues for testing state changes; final animation art is Phase 3.
      if (mood === 'Working') {
        context.strokeStyle = '#50382d';
        context.lineWidth = 1;
        context.strokeRect(41.5, 64.5, 7, 5);
        context.strokeRect(53.5, 64.5, 7, 5);
        context.fillStyle = '#50382d';
        context.fillRect(49, 65, 4, 1);
        context.fillStyle = '#d3a765';
        context.fillRect(81, 86, 12, 8);
        context.fillStyle = '#fff0cb';
        context.fillRect(82, 87, 10, 5);
      } else if (mood === 'TeaBreak') {
        context.fillStyle = '#50382d';
        context.fillRect(81, 84, 9, 10);
        context.fillRect(90, 86, 3, 5);
        context.fillStyle = '#fff0cb';
        context.fillRect(82, 85, 7, 8);
        context.fillStyle = '#b9b8aa';
        context.fillRect(83, 78, 1, 4);
        context.fillRect(86, 76, 1, 5);
      } else if (mood === 'Happy') {
        context.fillStyle = '#c46e72';
        const heart = ['0110110', '1111111', '0111110', '0011100', '0001000'];
        heart.forEach((row, y) =>
          [...row].forEach((pixel, x) => {
            if (pixel === '1') context.fillRect(78 + x, 48 + y, 1, 1);
          }),
        );
      }
      // A simple test ledge grounds the sprite. Final habitat art comes later.
      context.fillStyle = '#50382d';
      context.fillRect(5, 94, 100, 3);
      context.fillStyle = '#bb8957';
      context.fillRect(6, 94, 98, 1);
      context.fillStyle = '#77513c';
      context.fillRect(9, 97, 92, 3);
      // Use the final rendered pixels for hit testing, including the shelf.
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      return Array.from({ length: canvas.width * canvas.height }, (_, pixel) =>
        data[pixel * 4 + 3] > 0 ? 1 : 0,
      );
    },
  };
}
