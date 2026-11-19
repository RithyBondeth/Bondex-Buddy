import type { Mood } from '../engine/spirit';

export interface LifeFrame {
  blink: boolean;
  ear: number;
  tail: number;
  look: number;
}

const neutral: LifeFrame = { blink: false, ear: 0, tail: 0, look: 0 };
const pulse = (time: number, start: number, length: number) =>
  time >= start && time < start + length;

/** Deterministic variation: no random work or new timers inside the render loop. */
export function lifeAt(
  mood: Mood,
  elapsedMs: number,
  reduced = false,
): LifeFrame {
  if (reduced || mood === 'Sleeping' || mood === 'TeaBreak') return neutral;
  const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (mood === 'Happy') {
    if (time >= 2000) return neutral;
    return {
      blink: false,
      ear: time < 160 ? 1 : 0,
      tail: Math.round(Math.sin(time / 95) * Math.max(0, 2 - time / 1000)),
      look: 0,
    };
  }
  const cycle = Math.floor(time / 12000);
  const phase = time % 12000;
  // A different, reproducible offset each cycle keeps the gestures from marching together.
  const variation = ((cycle * 137 + 53) % 17) * 110;
  const blinkAt = 2400 + variation;
  const blink =
    pulse(phase, blinkAt, 130) ||
    pulse(phase, 8200 - variation / 2, 150) ||
    (cycle % 3 === 1 && pulse(phase, blinkAt + 280, 100));
  const earAt = 5100 + variation;
  const ear = pulse(phase, earAt, 110)
    ? 1
    : pulse(phase, earAt + 110, 100)
      ? -1
      : 0;
  return {
    blink,
    ear,
    tail: Math.round(Math.sin(time / 1350) * Math.sin(time / 3100)),
    look:
      mood === 'Idle' && pulse(phase, 9000, 1700) ? (cycle % 2 ? -1 : 1) : 0,
  };
}
