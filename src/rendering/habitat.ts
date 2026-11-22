import idleUrl from '../../assets/pets/ember-fox/reference.png';
import workingUrl from '../../assets/pets/ember-fox/artwork/working.png';
import sleepingUrl from '../../assets/pets/ember-fox/artwork/sleeping.png';
import teaUrl from '../../assets/pets/ember-fox/artwork/tea-break.png';
import happyUrl from '../../assets/pets/ember-fox/artwork/happy.png';
import { normalizeFoxPixels } from './palette';
import {
  anchorOffset,
  motionAt,
  spriteBands,
  type MotionFrame,
} from './motion';
import type { Mood } from '../engine/spirit';
import type { Decor, Outfit } from '../engine/progress';
import { drawParticles } from './particles';
import { lifeAt, type LifeFrame } from './life';
import {
  playPose,
  spriteForPlay,
  loadPlayFrames,
  type PetPlay,
} from './playful';

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
  setAttention: (horizontal: number | null) => void;
  draw: (
    mood: Mood,
    elapsedMs?: number,
    reduced?: boolean,
    appearance?: {
      decor: Decor;
      night: boolean;
      outfit?: Outfit;
      play?: PetPlay;
    },
  ) => number[];
}> {
  const output = canvas.getContext('2d');
  if (!output) throw new Error('Canvas is unavailable.');
  const petLayer = document.createElement('canvas');
  petLayer.width = canvas.width;
  petLayer.height = canvas.height;
  const petContext = petLayer.getContext('2d');
  if (!petContext) throw new Error('Canvas is unavailable.');
  petContext.imageSmoothingEnabled = false;
  const petScale = 1 / 2;
  const baseline = 94;
  const petWidth = Math.round(petLayer.width * petScale);
  const petHeight = Math.round(petLayer.height * petScale);
  const petLeft = Math.round((petLayer.width - petWidth) / 2);
  const petTop = baseline - Math.round(baseline * petScale);
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

  const playFrames = await loadPlayFrames();
  const rigs = new Map<string, HTMLCanvasElement>();
  const rigFor = (source: HTMLCanvasElement, mood: Mood, life: LifeFrame) => {
    if (mood === 'Sleeping' || mood === 'TeaBreak') return source;
    const key = `${mood}:${life.blink}:${life.ear}:${life.tail}:${life.look}`;
    const cached = rigs.get(key);
    if (cached) return cached;
    const rig = document.createElement('canvas');
    rig.width = source.width + 4;
    rig.height = source.height;
    const ctx = rig.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const headEnd = Math.floor(source.height * 0.58);
    const earEnd = Math.floor(source.height * 0.2);
    const tailStart = Math.floor(source.height * 0.8);
    // Move connected rows rather than rotating the raster and softening its pixels.
    for (let y = 0; y < source.height; y++) {
      const tailWeight = Math.max(
        0,
        (y - tailStart) / (source.height - tailStart),
      );
      const dx = y < headEnd ? life.look : Math.round(life.tail * tailWeight);
      if (y < earEnd) {
        const split = Math.floor(source.width / 2);
        ctx.drawImage(source, 0, y, split, 1, 2 + dx, y, split, 1);
        ctx.drawImage(
          source,
          split,
          y,
          source.width - split,
          1,
          split + 2 + dx,
          y + life.ear,
          source.width - split,
          1,
        );
      } else {
        ctx.drawImage(
          source,
          0,
          y,
          source.width,
          1,
          2 + dx,
          y,
          source.width,
          1,
        );
      }
    }
    if (mood === 'Idle') {
      const eyeY = Math.round(source.height * 0.35);
      for (const fraction of [0.28, 0.65]) {
        const eyeX = 2 + Math.round(source.width * fraction) + life.look;
        // The reference has sleepy lids. Open, highlighted eyes make idle attentive.
        ctx.fillStyle = '#d77641';
        ctx.fillRect(eyeX - 1, eyeY, 5, 3);
        ctx.fillStyle = '#372018';
        ctx.fillRect(eyeX, eyeY + (life.blink ? 1 : 0), 3, life.blink ? 1 : 3);
        if (!life.blink) {
          ctx.fillStyle = '#ffe4be';
          ctx.fillRect(eyeX, eyeY, 1, 1);
        }
      }
    } else if (life.blink && mood === 'Working') {
      // A slight contented squint while concentrating, without changing the pose.
      const eyeY = Math.round(source.height * 0.35);
      ctx.fillStyle = '#d77641';
      for (const fraction of [0.28, 0.65])
        ctx.fillRect(2 + Math.round(source.width * fraction), eyeY, 3, 1);
    }
    if (rigs.size >= 120) rigs.delete(rigs.keys().next().value!);
    rigs.set(key, rig);
    return rig;
  };

  const runners = new Map<string, HTMLCanvasElement>();
  const frames = new Map<
    string,
    { canvas: HTMLCanvasElement; mask: number[] }
  >();
  let lastCanvas: HTMLCanvasElement | undefined;
  let lastHadParticles = false;
  let lastNight = false;
  let attention: number | null = null;
  let gaze = 0;
  let lastElapsed = 0;
  const frameFor = (
    mood: Mood,
    motion: MotionFrame,
    decor: Decor,
    outfit: Outfit,
    life: LifeFrame,
    play: ReturnType<typeof playPose>,
  ) => {
    const { pose, x: sway, lift, breath } = motion;
    const key = `${mood}:${pose}:${sway}:${lift}:${breath}:${decor}:${outfit}:${life.blink}:${life.ear}:${life.tail}:${life.look}:${play.sheet}:${play.frame}:${play.facing}:${play.free}`;
    const cached = frames.get(key);
    if (cached) return cached;
    const frame = document.createElement('canvas');
    frame.width = canvas.width;
    frame.height = canvas.height;
    const context = frame.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable.');
    context.imageSmoothingEnabled = false;
    const original = sprites.get(mood)!;
    let sprite = rigFor(original, mood, life);
    if (play.frame >= 0) {
      const key = `${play.sheet}:${play.frame}:${outfit}`;
      let runner = runners.get(key);
      if (!runner) {
        runner = spriteForPlay(play.frame, play.sheet, outfit, playFrames);
        runners.set(key, runner);
      }
      sprite = runner;
    }
    const x = Math.floor((110 - sprite.width) / 2);
    const y = baseline - sprite.height;
    // The shadow stays grounded while the character and wardrobe travel together.
    petContext.clearRect(0, 0, petLayer.width, petLayer.height);
    petContext.fillStyle = '#695044';
    petContext.fillRect(
      39 + Math.min(lift, 5),
      baseline - 1,
      32 - Math.min(lift, 5) * 2,
      1,
    );
    petContext.save();
    petContext.translate(sway, -lift);
    if (play.facing === -1) {
      petContext.translate(110, 0);
      petContext.scale(-1, 1);
    }
    for (const band of spriteBands(sprite.height, pose, breath)) {
      petContext.drawImage(
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
    const head = anchorOffset(sprite.height, 0, pose, breath);
    const collar = anchorOffset(
      sprite.height,
      Math.min(sprite.height - 1, 76 - y),
      pose,
      breath,
    );
    petContext.translate(life.look, 0);
    if (play.frame < 0 && mood !== 'Sleeping' && outfit === 'beanie') {
      petContext.fillStyle = '#6c8390';
      petContext.fillRect(38, 49 + head, 31, 5);
      petContext.fillRect(42, 46 + head, 23, 4);
      petContext.fillRect(51, 43 + head, 5, 3);
      petContext.fillStyle = '#b9c6cb';
      petContext.fillRect(38, 53 + head, 31, 2);
    } else if (play.frame < 0 && mood !== 'Sleeping' && outfit === 'scarf') {
      petContext.fillStyle = '#b65e50';
      petContext.fillRect(42, 76 + collar, 23, 3);
      petContext.fillRect(43, 79 + collar, 5, 9);
    }
    petContext.restore();
    // Resize the assembled pose once to keep the wardrobe and animation bands aligned.
    context.drawImage(petLayer, petLeft, petTop, petWidth, petHeight);
    if (!play.free && decor === 'plant') {
      context.fillStyle = '#77513c';
      context.fillRect(23, 86, 12, 8);
      context.fillStyle = '#b98963';
      context.fillRect(24, 87, 10, 2);
      context.fillStyle = '#638260';
      context.fillRect(28, 77, 2, 10);
      context.fillRect(23, 79, 6, 3);
      context.fillRect(30, 76, 5, 3);
    } else if (!play.free && decor === 'lantern') {
      context.fillStyle = '#77513c';
      context.fillRect(24, 80, 11, 14);
      context.fillRect(27, 77, 5, 3);
      context.fillStyle = '#edc574';
      context.fillRect(26, 82, 7, 9);
    }
    if (!play.free) {
      // The pixel ledge anchors the character and doubles as its drag handle.
      context.fillStyle = '#50382d';
      context.fillRect(21, 94, 68, 3);
      context.fillStyle = '#bb8957';
      context.fillRect(22, 94, 66, 1);
      context.fillStyle = '#77513c';
      context.fillRect(25, 97, 60, 3);
    }
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
    if (frames.size >= 240) frames.delete(frames.keys().next().value!);
    frames.set(key, result);
    return result;
  };

  return {
    setAttention(horizontal) {
      attention =
        horizontal === null || !Number.isFinite(horizontal)
          ? null
          : Math.max(-1, Math.min(1, horizontal));
    },
    draw(
      mood,
      elapsedMs = 0,
      reduced = false,
      appearance = { decor: 'none', night: false },
    ) {
      const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
      const play = playPose(appearance.play, reduced);
      const displayMood: Mood = play.free ? 'Idle' : mood;
      const motion =
        play.frame >= 0
          ? { pose: 'rest' as const, x: 0, lift: play.lift, breath: 0 }
          : motionAt(displayMood, elapsed, reduced);
      const life =
        play.frame >= 0
          ? { blink: false, ear: 0, tail: 0, look: 0 }
          : { ...lifeAt(displayMood, elapsed, reduced) };
      const delta = Math.max(0, Math.min(100, elapsed - lastElapsed));
      lastElapsed = elapsed;
      gaze += ((attention ?? 0) - gaze) * (1 - Math.exp(-delta / 150));
      if (
        !reduced &&
        displayMood === 'Idle' &&
        play.frame < 0 &&
        (attention !== null || Math.abs(gaze) > 0.1)
      )
        life.look = Math.round(gaze);
      const frame = frameFor(
        displayMood,
        motion,
        appearance.decor,
        appearance.outfit ?? 'none',
        life,
        play,
      );
      const particles =
        !reduced &&
        (displayMood === 'TeaBreak' ||
          displayMood === 'Sleeping' ||
          displayMood === 'Happy');
      if (
        lastCanvas !== frame.canvas ||
        particles ||
        lastHadParticles ||
        lastNight !== appearance.night
      ) {
        output.clearRect(0, 0, canvas.width, canvas.height);
        output.imageSmoothingEnabled = false;
        output.drawImage(frame.canvas, 0, 0);
        if (particles) drawParticles(output, displayMood, elapsed);
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
