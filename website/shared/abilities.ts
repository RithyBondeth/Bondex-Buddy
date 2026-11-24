import {
  REACTION_MS as ABILITY_MS,
  type DeskSpiritId,
} from '../src/lib/pet-animation';
import type { HeroId } from './hero-motion';

export type CompanionId = HeroId | DeskSpiritId;

export const abilityNames = {
  ember: 'Foxfire spiral',
  moon: 'Constellation dance',
  moss: 'Wildflower bloom',
  'blue-jelly': 'Bubble bloom',
  'spider-man': 'Web swing',
  'iron-man': 'Repulsor flight',
  thor: 'Thunder call',
  hulk: 'Gamma stomp',
  'captain-america': 'Shield ricochet',
  'black-widow': 'Widow’s bite',
  hawkeye: 'Trick shot',
} satisfies Record<CompanionId, string>;

export { ABILITY_MS };
const clamp = (value: number) => Math.min(1, Math.max(0, value));
export const phase = (t: number, from: number, to: number) =>
  clamp((t - from) / (to - from));

/** A manual replay takes priority, including during focus. Automatic performances are idle-only. */
export function abilityTime(
  elapsed: number,
  replayAge: number,
  idle: boolean,
  calm: boolean,
) {
  if (calm) return null;
  if (replayAge >= 0 && replayAge < ABILITY_MS) return replayAge / ABILITY_MS;
  if (!idle || !Number.isFinite(elapsed)) return null;
  const age = (Math.max(0, elapsed) % 14500) - 1700;
  if (age < 0 || age >= ABILITY_MS || replayAge - age < ABILITY_MS + 1800)
    return null;
  return age / ABILITY_MS;
}

// Normalized time, horizontal travel, height above the ground, tilt in degrees, vertical stretch.
type Key = readonly [number, number, number, number, number];
const still: Key = [0, 0, 0, 0, 1];
const home: Key = [1, 0, 0, 0, 1];
const motion: Record<CompanionId, readonly Key[]> = {
  ember: [
    still,
    [0.16, -2, 0, -7, 0.9],
    [0.42, 3, 6, 8, 1.05],
    [0.67, 0, 2, -3, 1],
    [0.78, 0, 0, 0, 0.92],
    home,
  ],
  moon: [
    still,
    [0.22, 0, 1, -4, 0.98],
    [0.52, -2, 8, -9, 1.04],
    [0.77, 2, 6, 5, 1],
    home,
  ],
  moss: [
    still,
    [0.14, 0, 0, 0, 0.85],
    [0.32, -3, 8, -9, 1.08],
    [0.48, -3, 0, -2, 0.88],
    [0.67, 3, 5, 8, 1.04],
    [0.8, 1, 0, 2, 0.93],
    home,
  ],
  'blue-jelly': [
    still,
    [0.18, -2, 2, -6, 0.89],
    [0.45, 1, 10, 5, 1.1],
    [0.68, 3, 12, 8, 1.02],
    [0.85, 0, 5, -3, 0.96],
    home,
  ],
  'spider-man': [
    still,
    [0.14, -4, 0, -12, 0.79],
    [0.33, -7, 6, -22, 1.04],
    [0.55, 3, 16, 24, 0.95],
    [0.7, 9, 8, 16, 1.06],
    [0.83, 4, 0, -9, 0.81],
    home,
  ],
  'iron-man': [
    still,
    [0.19, 0, 0, 0, 0.92],
    [0.39, -2, 8, -5, 1.02],
    [0.62, -4, 11, -9, 1],
    [0.79, -2, 8, 1, 1],
    home,
  ],
  thor: [
    still,
    [0.22, -2, 0, -9, 0.94],
    [0.45, 0, 7, -13, 1.06],
    [0.56, 3, 0, 12, 0.86],
    [0.76, 2, 0, 5, 0.96],
    home,
  ],
  hulk: [
    still,
    [0.23, -1, 0, -6, 0.75],
    [0.43, 1, 13, 8, 1.09],
    [0.55, 3, 0, 3, 0.7],
    [0.69, 2, 0, -5, 0.89],
    home,
  ],
  'captain-america': [
    still,
    [0.22, -3, 0, -15, 0.92],
    [0.38, 3, 2, 14, 1.04],
    [0.66, 1, 0, 4, 0.97],
    [0.82, -2, 1, -10, 0.93],
    home,
  ],
  'black-widow': [
    still,
    [0.19, -4, 0, -14, 0.86],
    [0.34, 7, 3, 18, 0.97],
    [0.49, 4, 1, 8, 0.9],
    [0.62, -6, 5, -19, 0.97],
    [0.77, -3, 0, -9, 0.85],
    home,
  ],
  hawkeye: [
    still,
    [0.2, -2, 0, -8, 0.93],
    [0.43, -4, 1, -12, 1.03],
    [0.5, 0, 2, 4, 1.01],
    [0.72, 1, 0, 3, 0.98],
    home,
  ],
};

export function abilityPose(id: CompanionId, t: number) {
  const keys = motion[id];
  const index = keys.findIndex((key) => key[0] >= t);
  const a = keys[Math.max(0, index - 1)];
  const b = index < 0 ? home : keys[index];
  const u = a === b || index < 0 ? 1 : phase(t, a[0], b[0]);
  const ease = u * u * (3 - 2 * u);
  const mix = (start: number, end: number) => start + (end - start) * ease;
  return {
    x: mix(a[1], b[1]),
    lift: mix(a[2], b[2]),
    tilt: mix(a[3], b[3]),
    stretch: mix(a[4], b[4]),
  };
}

export type AbilityPose = ReturnType<typeof abilityPose>;

/** Apply around the feet, in the same 36-unit coordinate system as the effects. */
export function placeBody(
  ctx: CanvasRenderingContext2D,
  pose: AbilityPose,
  x: number,
  y: number,
  scale: number,
  facing: number,
) {
  ctx.translate(x + pose.x * scale * facing, y - pose.lift * scale);
  ctx.rotate((pose.tilt * facing * Math.PI) / 180);
  ctx.scale(1 / Math.sqrt(pose.stretch), pose.stretch);
  ctx.translate(-x, -y);
}
