import type { Mood } from '../engine/spirit';

export type Pose = 'rest' | 'inhale' | 'nod' | 'sip' | 'hop-low' | 'hop-high';
interface Beat {
  pose: Pose;
  durationMs: number;
}

/** Held pixel keyframes, independent of refresh rate. Happy plays once per greeting. */
export const MOTION: Record<Mood, readonly Beat[]> = {
  Idle: [
    { pose: 'rest', durationMs: 1400 },
    { pose: 'inhale', durationMs: 1100 },
    { pose: 'rest', durationMs: 1500 },
  ],
  Working: [
    { pose: 'rest', durationMs: 1800 },
    { pose: 'inhale', durationMs: 900 },
    { pose: 'rest', durationMs: 600 },
    { pose: 'nod', durationMs: 400 },
    { pose: 'rest', durationMs: 500 },
  ],
  Sleeping: [
    { pose: 'rest', durationMs: 1800 },
    { pose: 'inhale', durationMs: 2000 },
    { pose: 'rest', durationMs: 1400 },
  ],
  TeaBreak: [
    { pose: 'rest', durationMs: 2200 },
    { pose: 'sip', durationMs: 900 },
    { pose: 'rest', durationMs: 1300 },
  ],
  Happy: [
    { pose: 'hop-low', durationMs: 100 },
    { pose: 'hop-high', durationMs: 160 },
    { pose: 'hop-low', durationMs: 100 },
    { pose: 'rest', durationMs: 200 },
    { pose: 'hop-low', durationMs: 100 },
    { pose: 'rest', durationMs: 1340 },
  ],
};

export function clipDuration(mood: Mood): number {
  return MOTION[mood].reduce((total, beat) => total + beat.durationMs, 0);
}

export function poseAt(mood: Mood, elapsedMs: number, reduced = false): Pose {
  if (reduced) return 'rest';
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const duration = clipDuration(mood);
  if (mood === 'Happy' && elapsed >= duration) return 'rest';
  let time = elapsed % duration;
  for (const beat of MOTION[mood]) {
    if (time < beat.durationMs) return beat.pose;
    time -= beat.durationMs;
  }
  return 'rest';
}

export interface SpriteBand {
  sourceY: number;
  sourceHeight: number;
  destinationY: number;
  destinationHeight: number;
}

/** Integer-only row bands. Breathing/reading/sipping preserve the feet baseline. */
export function spriteBands(height: number, pose: Pose): SpriteBand[] {
  const band = (
    sourceY: number,
    sourceHeight: number,
    destinationY: number,
    destinationHeight: number,
  ) => ({ sourceY, sourceHeight, destinationY, destinationHeight });
  if (height < 8 || !Number.isInteger(height))
    throw new Error('Sprite height must be an integer of at least 8 pixels.');
  if (pose === 'inhale' || pose === 'nod') {
    const split = Math.floor(height * 0.57);
    const offset = pose === 'inhale' ? -1 : 1;
    return [
      band(0, split, offset, split),
      band(split, height - split, split + offset, height - split - offset),
    ];
  }
  if (pose === 'sip') {
    const start = Math.floor(height * 0.6);
    const end = Math.floor(height * 0.83);
    return [
      band(0, start, 0, start - 1),
      band(start, end - start, start - 1, end - start),
      band(end, height - end, end - 1, height - end + 1),
    ];
  }
  const lift = pose === 'hop-high' ? 2 : pose === 'hop-low' ? 1 : 0;
  return [band(0, height, -lift, height)];
}

/** Map a source anchor so wardrobe layers follow the same pixel deformation. */
export function anchorOffset(
  height: number,
  sourceY: number,
  pose: Pose,
): number {
  const band = spriteBands(height, pose).find(
    (b) => sourceY < b.sourceY + b.sourceHeight,
  )!;
  return (
    band.destinationY +
    Math.floor(
      ((sourceY - band.sourceY) * band.destinationHeight) / band.sourceHeight,
    ) -
    sourceY
  );
}
