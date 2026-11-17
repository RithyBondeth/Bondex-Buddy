import testSpiritUrl from '../../assets/pets/test-spirit/reference.png';
import type { Mood } from '../engine/spirit';
import type { Decor } from '../engine/progress';
import { drawParticles } from './particles';

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
): Promise<{
  draw: (
    mood: Mood,
    elapsedMs?: number,
    reduced?: boolean,
    appearance?: { decor: Decor; night: boolean },
  ) => number[];
}> {
  const output = canvas.getContext('2d');
  if (!output) throw new Error('Canvas is unavailable.');
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

  const frames = new Map<
    string,
    { canvas: HTMLCanvasElement; mask: number[] }
  >();
  let lastCanvas: HTMLCanvasElement | undefined;
  let lastHadParticles = false;
  let lastNight = false;
  const frameFor = (mood: Mood, pose: number, decor: Decor) => {
    const key = `${mood}:${pose}:${decor}`;
    const cached = frames.get(key);
    if (cached) return cached;
    const frame = document.createElement('canvas');
    frame.width = canvas.width;
    frame.height = canvas.height;
    const context = frame.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable.');
    context.imageSmoothingEnabled = false;
    const lift = mood === 'Happy' ? pose * 2 : mood === 'Idle' ? pose : 0;
    context.save();
    context.translate(0, -lift);
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
      context.fillRect(32, 80 - pose, 46, 14 + pose);
      context.fillStyle = '#adb7bf';
      context.fillRect(32, 80 - pose, 46, 2);
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
      context.fillStyle = '#50382d';
      context.fillRect(90 - pose, 85, 1, 6);
    } else if (mood === 'TeaBreak') {
      context.save();
      context.translate(0, -pose);
      context.fillStyle = '#50382d';
      context.fillRect(81, 84, 9, 10);
      context.fillRect(90, 86, 3, 5);
      context.fillStyle = '#fff0cb';
      context.fillRect(82, 85, 7, 8);
      context.restore();
    }
    context.restore();
    if (decor === 'plant') {
      context.fillStyle = '#77513c';
      context.fillRect(14, 86, 12, 8);
      context.fillStyle = '#b98963';
      context.fillRect(15, 87, 10, 2);
      context.fillStyle = '#638260';
      context.fillRect(19, 77, 2, 10);
      context.fillRect(14, 79, 6, 3);
      context.fillRect(21, 76, 5, 3);
    } else if (decor === 'lantern') {
      context.fillStyle = '#77513c';
      context.fillRect(15, 80, 11, 14);
      context.fillRect(18, 77, 5, 3);
      context.fillStyle = '#edc574';
      context.fillRect(17, 82, 7, 9);
    }
    // A simple test ledge grounds the sprite. Final habitat art comes later.
    context.fillStyle = '#50382d';
    context.fillRect(5, 94, 100, 3);
    context.fillStyle = '#bb8957';
    context.fillRect(6, 94, 98, 1);
    context.fillStyle = '#77513c';
    context.fillRect(9, 97, 92, 3);
    // Read pixels only when a cached pose is created, never on every RAF frame.
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let mask: number[] = Array.from(
      { length: canvas.width * canvas.height },
      (_, pixel) => (data[pixel * 4 + 3] > 0 ? 1 : 0),
    );
    // Share identical silhouettes, so color-only pose changes need no native IPC.
    for (const cached of frames.values()) {
      if (mask.every((value, index) => value === cached.mask[index])) {
        mask = cached.mask;
        break;
      }
    }
    const result = { canvas: frame, mask };
    frames.set(key, result);
    return result;
  };

  return {
    draw(
      mood,
      elapsedMs = 0,
      reduced = false,
      appearance = { decor: 'none', night: false },
    ) {
      const elapsed = Math.max(0, elapsedMs);
      const period =
        mood === 'Idle' || mood === 'Sleeping'
          ? 1600
          : mood === 'Happy'
            ? 260
            : 700;
      const pose = reduced ? 0 : Math.floor(elapsed / period) % 2;
      const frame = frameFor(mood, pose, appearance.decor);
      const particles =
        !reduced &&
        (mood === 'TeaBreak' || mood === 'Sleeping' || mood === 'Happy');
      if (
        lastCanvas !== frame.canvas ||
        particles ||
        lastHadParticles ||
        lastNight !== appearance.night
      ) {
        output.clearRect(0, 0, canvas.width, canvas.height);
        output.imageSmoothingEnabled = false;
        output.drawImage(frame.canvas, 0, 0);
        if (particles) drawParticles(output, mood, elapsed);
        if (appearance.night) {
          output.save();
          output.globalCompositeOperation = 'source-atop';
          output.fillStyle = 'rgba(224, 158, 77, 0.12)';
          output.fillRect(0, 0, canvas.width, canvas.height);
          output.restore();
        }
      }
      lastCanvas = frame.canvas;
      lastHadParticles = particles;
      lastNight = appearance.night;
      // Particles remain decorative and click-through, even where visibly painted.
      return frame.mask;
    },
  };
}
