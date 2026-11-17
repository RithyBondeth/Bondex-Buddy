import testSpiritUrl from '../../assets/pets/test-spirit/reference.png';

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

export async function renderHabitat(
  canvas: HTMLCanvasElement,
): Promise<number[]> {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  const image = new Image();
  image.src = testSpiritUrl;
  await image.decode();
  const bounds = opaqueBounds(image);
  const ratio = 48 / Math.max(bounds[2], bounds[3]);
  const width = Math.round(bounds[2] * ratio);
  const height = Math.round(bounds[3] * ratio);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  // A simple test ledge grounds the sprite. Final habitat art comes later.
  context.fillStyle = '#50382d';
  context.fillRect(5, 94, 100, 3);
  context.fillStyle = '#bb8957';
  context.fillRect(6, 94, 98, 1);
  context.fillStyle = '#77513c';
  context.fillRect(9, 97, 92, 3);
  context.drawImage(
    image,
    ...bounds,
    Math.floor((110 - width) / 2),
    94 - height,
    width,
    height,
  );
  // Use the final rendered pixels for hit testing, including the shelf.
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return Array.from({ length: canvas.width * canvas.height }, (_, pixel) =>
    data[pixel * 4 + 3] > 0 ? 1 : 0,
  );
}
