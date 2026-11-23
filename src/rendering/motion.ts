import type { Mood } from '../engine/spirit';

export type Pose =
  | 'rest'
  | 'inhale'
  | 'nod'
  | 'sip'
  | 'crouch'
  | 'stretch'
  | 'hop-low'
  | 'hop-high';
interface Beat {
  pose: Pose;
  durationMs: number;
}

/** Quiet held poses, with a single two-second greeting choreography. */
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
    { pose: 'crouch', durationMs: 120 },
    { pose: 'stretch', durationMs: 80 },
    { pose: 'hop-high', durationMs: 450 },
    { pose: 'crouch', durationMs: 120 },
    { pose: 'rest', durationMs: 40 },
    { pose: 'hop-low', durationMs: 380 },
    { pose: 'crouch', durationMs: 100 },
    { pose: 'rest', durationMs: 710 },
  ],
};

const safeElapsed = (ms: number) => (Number.isFinite(ms) ? Math.max(0, ms) : 0);

export function clipDuration(mood: Mood): number {
  return MOTION[mood].reduce((total, beat) => total + beat.durationMs, 0);
}

export function poseAt(mood: Mood, elapsedMs: number, reduced = false): Pose {
  if (reduced) return 'rest';
  const elapsed = safeElapsed(elapsedMs);
  const duration = clipDuration(mood);
  if (mood === 'Happy' && elapsed >= duration) return 'rest';
  let time = elapsed % duration;
  for (const beat of MOTION[mood]) {
    if (time < beat.durationMs) return beat.pose;
    time -= beat.durationMs;
  }
  return 'rest';
}

export interface MotionFrame {
  pose: Pose;
  x: number;
  lift: number;
  breath: number;
}

/** Sample ballistic arcs in whole pixels: crisp artwork, independent of frame rate. */
export function motionAt(
  mood: Mood,
  elapsedMs: number,
  reduced = false,
): MotionFrame {
  const elapsed = safeElapsed(elapsedMs);
  const pose = poseAt(mood, elapsed, reduced);
  if (reduced) return { pose, x: 0, lift: 0, breath: 0 };
  if (mood === 'Happy') {
    const start = pose === 'hop-high' ? 200 : 810;
    const duration = pose === 'hop-high' ? 450 : 380;
    const airborne = pose === 'hop-high' || pose === 'hop-low';
    const phase = Math.max(0, Math.min(1, (elapsed - start) / duration));
    return {
      pose,
      breath: 0,
      x: airborne ? Math.round(Math.sin(phase * Math.PI * 2)) : 0,
      lift: airborne
        ? Math.round((pose === 'hop-high' ? 9 : 4) * 4 * phase * (1 - phase))
        : 0,
    };
  }
  const period = mood === 'Sleeping' ? 6400 : mood === 'Working' ? 5000 : 4400;
  return {
    pose,
    x: 0,
    lift: 0,
    breath: -Math.round(
      (1 - Math.cos((elapsed / period) * Math.PI * 2)) * 0.75,
    ),
  };
}

export interface SpriteBand {
  sourceY: number;
  sourceHeight: number;
  destinationY: number;
  destinationHeight: number;
}

/** Integer-only row bands. Grounded poses keep the feet at the baseline. */
export function spriteBands(
  height: number,
  pose: Pose,
  breath?: number,
): SpriteBand[] {
  const band = (
    sourceY: number,
    sourceHeight: number,
    destinationY: number,
    destinationHeight: number,
  ) => ({ sourceY, sourceHeight, destinationY, destinationHeight });
  if (height < 8 || !Number.isInteger(height))
    throw new Error('Sprite height must be an integer of at least 8 pixels.');
  if (['rest', 'inhale', 'nod', 'crouch', 'stretch'].includes(pose)) {
    const split = Math.floor(height * 0.57);
    const offset =
      pose === 'crouch'
        ? 2
        : pose === 'stretch'
          ? -2
          : pose === 'nod'
            ? (breath ?? 0) + 1
            : (breath ?? (pose === 'inhale' ? -1 : 0));
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
  return [band(0, height, 0, height)];
}

/** Map a source anchor so wardrobe layers follow the same pixel deformation. */
export function anchorOffset(
  height: number,
  sourceY: number,
  pose: Pose,
  breath?: number,
): number {
  const band = spriteBands(height, pose, breath).find(
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
