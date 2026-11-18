import idleUrl from '../../assets/pets/ember-fox/reference.png';
import workingUrl from '../../assets/pets/ember-fox/artwork/working.png';
import sleepingUrl from '../../assets/pets/ember-fox/artwork/sleeping.png';
import teaUrl from '../../assets/pets/ember-fox/artwork/tea-break.png';
import happyUrl from '../../assets/pets/ember-fox/artwork/happy.png';
import { normalizeFoxPixels } from './palette';
import { anchorOffset, poseAt, spriteBands, type Pose } from './motion';
import type { Mood } from '../engine/spirit';
import type { Decor, Outfit } from '../engine/progress';
import { drawParticles } from './particles';

/** Crop transparent padding at render time; source artwork stays untouched. */
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
      if (data[(y * source.width + x) * 4 + 3]! < 128) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('The fox artwork is empty.');
  return [left, top, right - left + 1, bottom - top + 1];
}

export async function createHabitatRenderer(
  canvas: HTMLCanvasElement,
): Promise<{
  draw: (
    mood: Mood,
    elapsedMs?: number,
    reduced?: boolean,
    appearance?: { decor: Decor; night: boolean; outfit?: Outfit },
  ) => number[];
}> {
  const output = canvas.getContext('2d');
  if (!output) throw new Error('Canvas is unavailable.');
  const sources: Record<Mood, string> = {
    Idle: idleUrl,
    Working: workingUrl,
    Sleeping: sleepingUrl,
    TeaBreak: teaUrl,
    Happy: happyUrl,
  };
  const sprites = new Map<Mood, HTMLCanvasElement>();
  await Promise.all(
    Object.entries(sources).map(async ([mood, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const bounds = opaqueBounds(image);
      const ratio = 48 / Math.max(bounds[2], bounds[3]);
      const sprite = document.createElement('canvas');
      sprite.width = Math.round(bounds[2] * ratio);
      sprite.height = Math.round(bounds[3] * ratio);
      const pixels = sprite.getContext('2d');
      if (!pixels) throw new Error('Canvas is unavailable.');
      pixels.imageSmoothingEnabled = false;
      pixels.drawImage(image, ...bounds, 0, 0, sprite.width, sprite.height);
      const frame = pixels.getImageData(0, 0, sprite.width, sprite.height);
      normalizeFoxPixels(frame.data);
      pixels.putImageData(frame, 0, 0);
      sprites.set(mood as Mood, sprite);
    }),
  );

  const frames = new Map<
    string,
    { canvas: HTMLCanvasElement; mask: number[] }
  >();
  let lastCanvas: HTMLCanvasElement | undefined;
  let lastHadParticles = false;
  let lastNight = false;
  const frameFor = (mood: Mood, pose: Pose, decor: Decor, outfit: Outfit) => {
    const key = `${mood}:${pose}:${decor}:${outfit}`;
    const cached = frames.get(key);
    if (cached) return cached;
    const frame = document.createElement('canvas');
    frame.width = canvas.width;
    frame.height = canvas.height;
    const context = frame.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable.');
    context.imageSmoothingEnabled = false;
    const sprite = sprites.get(mood)!;
    const x = Math.floor((110 - sprite.width) / 2);
    const y = 94 - sprite.height;
    for (const band of spriteBands(sprite.height, pose)) {
      context.drawImage(
        sprite,
        0,
        band.sourceY,
        sprite.width,
        band.sourceHeight,
        x,
        y + band.destinationY,
        sprite.width,
        band.destinationHeight,
      );
    }
    const head = anchorOffset(sprite.height, 0, pose);
    const collar = anchorOffset(
      sprite.height,
      Math.min(sprite.height - 1, 76 - y),
      pose,
    );
    if (mood !== 'Sleeping' && outfit === 'beanie') {
      context.fillStyle = '#6c8390';
      context.fillRect(38, 49 + head, 31, 5);
      context.fillRect(42, 46 + head, 23, 4);
      context.fillRect(51, 43 + head, 5, 3);
      context.fillStyle = '#b9c6cb';
      context.fillRect(38, 53 + head, 31, 2);
    } else if (mood !== 'Sleeping' && outfit === 'scarf') {
      context.fillStyle = '#b65e50';
      context.fillRect(42, 76 + collar, 23, 3);
      context.fillRect(43, 79 + collar, 5, 9);
    }
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
    // The pixel ledge anchors the character and doubles as its drag handle.
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
      const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
      const pose = poseAt(mood, elapsed, reduced);
      const frame = frameFor(
        mood,
        pose,
        appearance.decor,
        appearance.outfit ?? 'none',
      );
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
