import type { Outfit } from '../engine/progress';
import walkUrl from '../../assets/pets/ember-fox/artwork/walk-cycle-v1.png';
import runUrl from '../../assets/pets/ember-fox/artwork/run-cycle-v1.png';
import playUrl from '../../assets/pets/ember-fox/artwork/play-cycle-v1.png';
import { normalizeFoxPixels } from './palette';

export type PlayAction =
  | 'rest'
  | 'walk'
  | 'run'
  | 'pounce'
  | 'hide'
  | 'peek'
  | 'climbUp'
  | 'climbDown'
  | 'cling';
export type PlaySheet = 'walk' | 'run' | 'play';
export const POUNCE_BEATS = [320, 140, 90, 180, 110, 120, 200, 340] as const;
export const POUNCE_MS = POUNCE_BEATS.reduce((sum, ms) => sum + ms, 0);
export interface PetPlay {
  action: PlayAction;
  facing: -1 | 1;
  elapsedMs: number;
  durationMs?: number;
  roaming: boolean;
  enabled: boolean;
  gaitMs?: number;
  gaitRate?: number;
  water?: 'walk' | 'offer' | 'return' | null;
}
export const restingPlay = (): PetPlay => ({
  action: 'rest',
  facing: -1,
  elapsedMs: 0,
  roaming: false,
  enabled: true,
});
const safeTime = (ms: number) => (Number.isFinite(ms) ? Math.max(0, ms) : 0);
export function playPose(play?: PetPlay, reduced = false) {
  if (!play || reduced || !play.roaming)
    return {
      frame: -1,
      lift: 0,
      facing: 1,
      free: false,
      sheet: 'walk' as PlaySheet,
      wall: 0,
      grip: 0,
      stride: 0,
    };
  const time = safeTime(play.elapsedMs);
  const wall =
    play.action === 'climbUp'
      ? 1
      : play.action === 'climbDown'
        ? -1
        : play.action === 'cling'
          ? 2
          : 0;
  const contactTime =
    wall === 1
      ? time
      : wall === -1 && play.durationMs !== undefined
        ? play.durationMs - time
        : 250;
  const grip = wall
    ? Math.round(8 * Math.min(1, Math.max(0, contactTime / 250))) / 8
    : 0;
  const locomotion =
    Math.abs(wall) === 1 || play.action === 'walk' || play.action === 'run';
  const gait =
    locomotion && Number.isFinite(play.gaitMs) ? safeTime(play.gaitMs!) : time;
  const cycle = play.action === 'run' ? 560 : 880;
  const progress = (gait % cycle) / cycle;
  // Reverse the footfalls on descent. Quantized contacts keep native hit masks reusable.
  const stride = locomotion
    ? Math.round(4 * Math.sin(progress * Math.PI * 2)) * (wall === -1 ? -1 : 1)
    : 0;
  const sheet: PlaySheet =
    play.action === 'run'
      ? 'run'
      : play.action === 'pounce' ||
          play.action === 'hide' ||
          play.action === 'peek'
        ? 'play'
        : 'walk';
  let frame = locomotion
    ? Math.floor(gait / (play.action === 'run' ? 70 : 110)) % 8
    : 0;
  if (wall === -1) frame = (8 - frame) % 8;
  if (play.action === 'rest') frame = -1;
  if (play.action === 'pounce') {
    let phase = time;
    frame = 7;
    for (let i = 0; i < POUNCE_BEATS.length; i++) {
      if (phase < POUNCE_BEATS[i]!) {
        frame = i;
        break;
      }
      phase -= POUNCE_BEATS[i]!;
    }
  } else if (play.action === 'hide') frame = 1;
  else if (play.action === 'peek') frame = 7;
  const flight = Math.max(0, Math.min(1, (time - 460) / 340));
  return {
    frame,
    sheet,
    lift:
      play.action === 'pounce' ? Math.round(11 * 4 * flight * (1 - flight)) : 0,
    facing: play.facing === -1 ? -1 : 1,
    free: true,
    wall,
    grip,
    stride,
  };
}

export interface AuthoredFrame {
  canvas: HTMLCanvasElement;
  headX: number;
  headY: number;
}
export type PlayFrames = Record<PlaySheet, readonly AuthoredFrame[]>;

/** Shared scale per sheet; runs register at the ears to retain true airborne paw clearance. */
async function loadSheet(
  url: string,
  registration: 'ground' | 'head',
): Promise<AuthoredFrame[]> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const context = source.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  const opaque = (x: number, y: number) =>
    pixels[(y * source.width + x) * 4 + 3]! >= 128;
  const bounds = Array.from({ length: 8 }, (_, frame) => {
    const col = frame % 4,
      row = Math.floor(frame / 4);
    const left = Math.floor((col * source.width) / 4),
      right = Math.floor(((col + 1) * source.width) / 4);
    const top = Math.floor((row * source.height) / 2),
      bottom = Math.floor(((row + 1) * source.height) / 2);
    let x1 = right,
      y1 = bottom,
      x2 = left - 1,
      y2 = top - 1;
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++)
        if (opaque(x, y)) {
          x1 = Math.min(x1, x);
          y1 = Math.min(y1, y);
          x2 = Math.max(x2, x);
          y2 = Math.max(y2, y);
        }
    if (x2 < x1) throw new Error('An Ember action frame is empty.');
    const width = x2 - x1 + 1,
      height = y2 - y1 + 1;
    let earY = y2,
      earLeft = x2,
      earRight = x1;
    const headLeft = x1 + Math.floor(width * 0.55);
    for (let y = y1; y <= y2; y++) {
      let found = false;
      for (let x = headLeft; x <= x2; x++)
        if (opaque(x, y)) {
          earY = y;
          found = true;
          break;
        }
      if (found) break;
    }
    for (let y = earY; y <= Math.min(y2, earY + Math.round(height * 0.1)); y++)
      for (let x = headLeft; x <= x2; x++)
        if (opaque(x, y)) {
          earLeft = Math.min(earLeft, x);
          earRight = Math.max(earRight, x);
        }
    return {
      x: x1,
      y: y1,
      width,
      height,
      earY,
      earX: (earLeft + earRight) / 2,
    };
  });
  const above = Math.max(...bounds.map((b) => b.earY - b.y));
  const below = Math.max(...bounds.map((b) => b.y + b.height - b.earY));
  const extent =
    registration === 'head'
      ? above + below
      : Math.max(...bounds.map((b) => b.height));
  const scale = 48 / Math.max(extent, ...bounds.map((b) => b.width));
  const headLine = 48 - Math.round(below * scale);
  return bounds.map((b) => {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const width = Math.round(b.width * scale),
      height = Math.round(b.height * scale);
    const x = Math.floor((48 - width) / 2);
    const y =
      registration === 'head'
        ? headLine - Math.round((b.earY - b.y) * scale)
        : 48 - height;
    ctx.drawImage(source, b.x, b.y, b.width, b.height, x, y, width, height);
    const frame = ctx.getImageData(0, 0, 48, 48);
    normalizeFoxPixels(frame.data);
    ctx.putImageData(frame, 0, 0);
    return {
      canvas,
      headX: x + Math.round((b.earX - b.x) * scale),
      headY: y + Math.round((b.earY - b.y) * scale),
    };
  });
}
export async function loadPlayFrames(): Promise<PlayFrames> {
  const [walk, run, play] = await Promise.all([
    loadSheet(walkUrl, 'ground'),
    loadSheet(runUrl, 'head'),
    loadSheet(playUrl, 'ground'),
  ]);
  return { walk, run, play };
}

/** Whole authored poses; wardrobe follows each frame's head and chest anchors. */
export function spriteForPlay(
  frame: number,
  sheet: PlaySheet,
  outfit: Outfit,
  frames: PlayFrames,
): HTMLCanvasElement {
  const source = frames[sheet][((Math.floor(frame) % 8) + 8) % 8]!;
  if (outfit === 'none') return source.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source.canvas, 0, 0);
  const x = source.headX,
    y = source.headY;
  if (outfit === 'beanie') {
    ctx.fillStyle = '#6c8390';
    ctx.fillRect(x - 12, y + 4, 24, 5);
    ctx.fillRect(x - 9, y + 1, 18, 4);
    ctx.fillRect(x - 2, y - 2, 5, 3);
    ctx.fillStyle = '#b9c6cb';
    ctx.fillRect(x - 12, y + 8, 24, 2);
  } else {
    ctx.fillStyle = '#b65e50';
    const neckY = Math.min(39, y + 23);
    ctx.fillRect(x - 4, neckY, 16, 3);
    ctx.fillRect(x - 6, neckY + 3, 5, Math.min(6, 45 - neckY));
  }
  return canvas;
}

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export const PLAY_DEMO_MS = 14000;
/** Preview the native sequence, including finite concealment and a held curious peek. */
export function samplePlayDemo(elapsedMs: number, span: number) {
  const time = safeTime(elapsedMs) % PLAY_DEMO_MS;
  const reach = Number.isFinite(span) ? Math.max(0, span) : 0;
  let action: PlayAction = 'rest',
    facing: -1 | 1 = -1,
    phase = 0,
    x = -reach,
    y = 0,
    gaitMs = 0;
  const travel = (
    start: number,
    end: number,
    t: number,
    kind: 'walk' | 'run',
  ) => {
    x = start + (end - start) * smooth(t);
    facing = end >= start ? 1 : -1;
    gaitMs =
      (Math.abs(x - start) / 1.5) * (kind === 'run' ? 560 / 84 : 880 / 48);
  };
  if (time < 2200) {
    action = 'run';
    phase = time;
    travel(-reach, reach, time / 2200, 'run');
  } else if (time < 3700) {
    action = 'pounce';
    phase = time - 2200;
    x = reach;
    facing = 1;
  } else if (time < 5700) {
    action = 'walk';
    phase = time - 3700;
    travel(reach, 0, phase / 2000, 'walk');
  } else if (time < 7050) {
    action = 'hide';
    phase = time - 5700;
    x = 0;
    y = 120 * smooth(phase / 650);
  } else if (time < 8650) {
    action = 'peek';
    phase = time - 7050;
    x = 0;
    y = 120 - 72 * smooth(phase / 550);
  } else if (time < 9650) {
    action = 'hide';
    phase = time - 8650;
    x = 0;
    y = 48 + 72 * smooth(phase / 500);
  } else if (time < 10500) {
    action = 'peek';
    phase = time - 9650;
    x = 0;
    y = 120 * (1 - smooth(phase / 850));
  } else if (time < 12500) {
    action = 'run';
    phase = time - 10500;
    travel(0, -reach, phase / 2000, 'run');
  }
  const play: PetPlay = {
    ...restingPlay(),
    roaming: true,
    action,
    facing,
    elapsedMs: phase,
    gaitMs,
  };
  return { play, x, y };
}
